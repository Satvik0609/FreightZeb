const { prisma } = require('../config/db');
const logger = require('../config/logger');
const { parsePagination } = require('../helpers/pagination');
const { haversineKm } = require('../services/routeService');

const OPERATING_COST_PER_KM = {
  SMALL_VAN: 18,
  CONTAINER_20FT: 32,
  CONTAINER_32FT: 42,
  FLATBED_TRAILER: 48,
  REEFER: 55,
};

function getCity(location) {
  return String(location?.city || location?.address || '').trim().toLowerCase();
}

function routeScore(truck, shipment) {
  const fromCity = getCity(shipment.pickupLocation);
  const toCity = getCity(shipment.destination);
  const truckFrom = String(truck.routeFrom || '').trim().toLowerCase();
  const truckTo = String(truck.routeTo || '').trim().toLowerCase();

  if (!fromCity || !toCity || !truckFrom || !truckTo) return 0.5;

  const fromMatch = fromCity.includes(truckFrom) || truckFrom.includes(fromCity);
  const toMatch = toCity.includes(truckTo) || truckTo.includes(toCity);
  if (fromMatch && toMatch) return 1;
  if (fromMatch || toMatch) return 0.55;
  return 0.15;
}

function shipmentDistanceKm(shipment) {
  const origin = shipment.pickupLocation || {};
  const destination = shipment.destination || {};
  const lat1 = Number(origin.lat);
  const lng1 = Number(origin.lng);
  const lat2 = Number(destination.lat);
  const lng2 = Number(destination.lng);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  return Number(haversineKm(lat1, lng1, lat2, lng2).toFixed(2));
}

function scoreShipmentForTruck(truck, shipment) {
  const distanceKm = shipmentDistanceKm(shipment);
  const pricePerKm = Number(truck.pricePerKm || 0);
  const operatingCostPerKm = OPERATING_COST_PER_KM[truck.truckType] || 35;
  const estimatedRevenue = distanceKm !== null && pricePerKm > 0
    ? Number((pricePerKm * distanceKm).toFixed(2))
    : null;
  const estimatedCost = distanceKm !== null
    ? Number((operatingCostPerKm * distanceKm).toFixed(2))
    : null;
  const estimatedProfit = estimatedRevenue !== null && estimatedCost !== null
    ? Number((estimatedRevenue - estimatedCost).toFixed(2))
    : null;

  const weightUtilization = Math.min(shipment.weightKg / truck.capacityKg, 1);
  const volumeUtilization = shipment.volumeM3 && truck.capacityM3
    ? Math.min(shipment.volumeM3 / truck.capacityM3, 1)
    : weightUtilization;
  const utilizationScore = (weightUtilization + volumeUtilization) / 2;
  const laneScore = routeScore(truck, shipment);
  const profitScore = estimatedRevenue && estimatedProfit !== null
    ? Math.max(0, Math.min(1, estimatedProfit / estimatedRevenue))
    : 0.4;
  const urgencyScore = shipment.deadline ? 0.8 : 0.45;

  const score = (
    utilizationScore * 0.4 +
    laneScore * 0.25 +
    profitScore * 0.25 +
    urgencyScore * 0.1
  ) * 100;

  return {
    shipment,
    score: Number(score.toFixed(1)),
    distanceKm,
    estimatedRevenue,
    estimatedCost,
    estimatedProfit,
    marginPct: estimatedRevenue && estimatedProfit !== null
      ? Number(((estimatedProfit / estimatedRevenue) * 100).toFixed(1))
      : null,
    breakdown: {
      utilizationScore: Number((utilizationScore * 100).toFixed(1)),
      routeScore: Number((laneScore * 100).toFixed(1)),
      profitScore: Number((profitScore * 100).toFixed(1)),
      urgencyScore: Number((urgencyScore * 100).toFixed(1)),
    },
  };
}

// Dealer: add truck
async function createTruck(req, res, next) {
  try {
    const { registrationNo, truckType, capacityKg, capacityM3, routeFrom, routeTo, pricePerKm } = req.body;

    const truck = await prisma.truck.create({
      data: {
        dealerId: req.user.id,
        registrationNo,
        truckType,
        capacityKg,
        capacityM3: capacityM3 || null,
        routeFrom,
        routeTo,
        pricePerKm: pricePerKm || null,
        status: 'AVAILABLE',
        availability: true,
      },
    });

    logger.info(`Truck added: ${truck.registrationNo} by dealer ${req.user.id}`);
    res.status(201).json({ success: true, truck });

    // ── Async: run ML predictions on best-matching pending shipments ──────────
    setImmediate(async () => {
      try {
        const mlService = require('../services/mlService');

        // Find pending shipments this truck can handle
        const shipments = await prisma.shipment.findMany({
          where: {
            status: { in: ['PENDING', 'OPTIMIZED'] },
            weightKg: { lte: capacityKg },
            ...(capacityM3 ? { OR: [{ volumeM3: null }, { volumeM3: { lte: capacityM3 } }] } : {}),
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

        if (shipments.length === 0) return;

        logger.info(`Truck ${truck.id}: running ML predictions on ${shipments.length} matching shipments`);

        for (const shipment of shipments) {
          try {
            const origin = shipment.pickupLocation || {};
            const dest = shipment.destination || {};
            const lat1 = Number(origin.lat), lng1 = Number(origin.lng);
            const lat2 = Number(dest.lat), lng2 = Number(dest.lng);
            let distanceKm = 700;
            if ([lat1, lng1, lat2, lng2].every(Number.isFinite)) {
              const R = 6371;
              const dLat = ((lat2 - lat1) * Math.PI) / 180;
              const dLng = ((lng2 - lng1) * Math.PI) / 180;
              const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
              distanceKm = Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
            }

            const [etaResult, fuelResult, delayResult] = await Promise.all([
              mlService.predictDeliveryTime({ weight_kg: shipment.weightKg, distance_km: distanceKm, truck_type: truckType, traffic_condition: 'MODERATE', weather_condition: 'CLEAR' }),
              mlService.estimateFuel({ distance_km: distanceKm, weight_kg: shipment.weightKg, truck_type: truckType }),
              mlService.predictDelayRisk({ distance_km: distanceKm, weight_kg: shipment.weightKg, truck_type: truckType, weather_condition: 'CLEAR', traffic_condition: 'MODERATE', time_of_day: 'AFTERNOON' }),
            ]);

            const predictions = [];
            if (etaResult?.predicted_hours != null) predictions.push({ shipmentId: shipment.id, type: 'ETA_HOURS', value: etaResult.predicted_hours, confidence: etaResult.confidence ?? null, modelVersion: etaResult.fallback ? 'fallback-heuristic' : '2.0.0' });
            const fuelLiters = fuelResult?.estimated_liters;
            if (fuelLiters != null) predictions.push({ shipmentId: shipment.id, type: 'FUEL_ESTIMATE_LITERS', value: fuelLiters, confidence: fuelResult.confidence ?? null, modelVersion: fuelResult.fallback ? 'fallback-heuristic' : '2.0.0' });
            const co2Kg = fuelResult?.co2_emissions_kg ?? fuelResult?.co2_kg ?? mlService.estimateCo2(distanceKm, truckType);
            if (co2Kg != null) predictions.push({ shipmentId: shipment.id, type: 'CO2_KG', value: co2Kg, confidence: null, modelVersion: 'derived-from-fuel-model' });
            if (delayResult?.delay_probability != null) predictions.push({ shipmentId: shipment.id, type: 'DELAY_RISK_PERCENT', value: delayResult.delay_probability, confidence: delayResult.confidence ?? null, modelVersion: delayResult.fallback ? 'fallback-heuristic' : '2.0.0' });

            if (predictions.length > 0) {
              // Upsert: delete old predictions of same types, insert new ones
              await prisma.prediction.deleteMany({ where: { shipmentId: shipment.id, type: { in: predictions.map(p => p.type) } } });
              await prisma.prediction.createMany({ data: predictions });
              logger.info(`Truck ${truck.id}: updated ${predictions.length} predictions for shipment ${shipment.id}`);
            }
          } catch (err) {
            logger.warn(`Truck ML prediction failed for shipment ${shipment.id}: ${err.message}`);
          }
        }
      } catch (err) {
        logger.warn(`Truck ML async block failed: ${err.message}`);
      }
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Registration number already exists' });
    }
    next(err);
  }
}

// Dealer: get own trucks
async function getMyTrucks(req, res, next) {
  try {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const where = { dealerId: req.user.id };
    if (status) where.status = status;

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.truck.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trucks });
  } catch (err) {
    next(err);
  }
}

// Admin: get all trucks
async function getAllTrucks(req, res, next) {
  try {
    const { status, truckType, dealerId } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (status) where.status = status;
    if (truckType) where.truckType = truckType;
    if (dealerId) where.dealerId = dealerId;

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        include: { dealer: { select: { id: true, name: true, email: true, company: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.truck.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trucks });
  } catch (err) {
    next(err);
  }
}

// Public (authenticated): available trucks for optimization
async function getAvailableTrucks(req, res, next) {
  try {
    const { minCapacityKg, truckType, routeFrom, routeTo } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 100, 50);
    const where = { status: 'AVAILABLE', availability: true };
    if (truckType) where.truckType = truckType;
    if (minCapacityKg) where.capacityKg = { gte: parseFloat(minCapacityKg) };
    if (routeFrom) where.routeFrom = { contains: routeFrom, mode: 'insensitive' };
    if (routeTo) where.routeTo = { contains: routeTo, mode: 'insensitive' };

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        include: { dealer: { select: { id: true, name: true, company: true } } },
        orderBy: { capacityKg: 'asc' },
        skip,
        take: limit,
      }),
      prisma.truck.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trucks });
  } catch (err) {
    next(err);
  }
}

// Dealer: find best open shipments for one of their trucks
async function getTruckShipmentMatches(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const truck = await prisma.truck.findUnique({
      where: { id: req.params.id },
      include: { dealer: { select: { id: true, name: true, company: true } } },
    });

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    if (truck.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // If truck isn't available, return empty matches with a clear reason
    if (truck.status !== 'AVAILABLE' || !truck.availability) {
      return res.json({ success: true, truck, total: 0, matches: [], unavailable: true, reason: `Truck is currently ${truck.status}` });
    }

    const shipments = await prisma.shipment.findMany({
      where: {
        status: { in: ['PENDING', 'OPTIMIZED'] },
        weightKg: { lte: truck.capacityKg },
        ...(truck.capacityM3
          ? {
            OR: [
              { volumeM3: null },
              { volumeM3: { lte: truck.capacityM3 } },
            ],
          }
          : {}),
      },
      include: {
        warehouse: { select: { id: true, name: true, company: true } },
        predictions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const matches = shipments
      .map((shipment) => scoreShipmentForTruck(truck, shipment))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.estimatedProfit || 0) - (a.estimatedProfit || 0);
      })
      .slice(0, take);

    res.json({ success: true, truck, total: matches.length, matches });
  } catch (err) {
    next(err);
  }
}

// Get single truck
async function getTruck(req, res, next) {
  try {
    const truck = await prisma.truck.findUnique({
      where: { id: req.params.id },
      include: {
        dealer: { select: { id: true, name: true, email: true, phone: true, company: true } },
        bookings: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    res.json({ success: true, truck });
  } catch (err) {
    next(err);
  }
}

// Dealer: update own truck
async function updateTruck(req, res, next) {
  try {
    const truck = await prisma.truck.findUnique({ where: { id: req.params.id } });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    if (truck.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Only include fields that were actually provided — never send undefined to Prisma
    // as it can silently nullify non-nullable columns.
    const { truckType, capacityKg, capacityM3, routeFrom, routeTo, pricePerKm, availability, status } = req.body;
    const data = {};
    if (truckType !== undefined) data.truckType = truckType;
    if (capacityKg !== undefined) data.capacityKg = capacityKg;
    if (capacityM3 !== undefined) data.capacityM3 = capacityM3;
    if (routeFrom !== undefined) data.routeFrom = routeFrom;
    if (routeTo !== undefined) data.routeTo = routeTo;
    if (pricePerKm !== undefined) data.pricePerKm = pricePerKm;
    if (availability !== undefined) data.availability = availability;
    if (status !== undefined) data.status = status;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    const updated = await prisma.truck.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, truck: updated });
  } catch (err) {
    next(err);
  }
}

// Dealer: update truck GPS location
async function updateTruckLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;

    const truck = await prisma.truck.findUnique({ where: { id: req.params.id } });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    if (truck.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await prisma.truck.update({
      where: { id: req.params.id },
      data: { currentLocation: { lat, lng, lastUpdated: new Date() } },
    });

    const io = req.app.get('io');
    io.to(`truck:${truck.id}`).emit('truck:location', { truckId: truck.id, location: updated.currentLocation });

    res.json({ success: true, truck: updated });
  } catch (err) {
    next(err);
  }
}

// Admin: delete truck
async function deleteTruck(req, res, next) {
  try {
    await prisma.truck.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Truck deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Truck not found' });
    next(err);
  }
}

module.exports = {
  createTruck,
  getMyTrucks,
  getAllTrucks,
  getAvailableTrucks,
  getTruckShipmentMatches,
  getTruck,
  updateTruck,
  updateTruckLocation,
  deleteTruck,
};
