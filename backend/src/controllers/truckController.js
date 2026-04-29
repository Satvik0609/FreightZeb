const { prisma } = require('../config/db');
const logger = require('../config/logger');
const { parsePagination } = require('../helpers/pagination');
const { calculateRoute } = require('../services/routeService');
const pricingService = require('../services/pricingService');
const dealerMlAutomationService = require('../services/dealerMlAutomationService');
const { queueNewTruckAutomation } = require('../queues/mlQueue');

const ACTIVE_BOOKING_STATUSES = ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

const OPERATING_COST_PER_KM = {
  SMALL_VAN: 8,
  CONTAINER_20FT: 19,
  CONTAINER_32FT: 25,
  FLATBED_TRAILER: 28,
  REEFER: 35,
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasValidCoordinates(location) {
  if (!location) return false;
  const lat = toNumber(location.lat);
  const lng = toNumber(location.lng);
  return lat !== null && lng !== null;
}

function routeText(location) {
  if (!location || typeof location !== 'object') return '';
  return [location.city, location.address].filter(Boolean).join(' ').toLowerCase();
}

function isRouteCompatible(truck, shipment) {
  const from = String(truck.routeFrom || '').toLowerCase();
  const to = String(truck.routeTo || '').toLowerCase();
  if (!from && !to) return true;

  const pickupText = routeText(shipment.pickupLocation);
  const destinationText = routeText(shipment.destination);
  const fromOk = !from || pickupText.includes(from);
  const toOk = !to || destinationText.includes(to);
  return fromOk && toOk;
}

function estimateOperatingCost(distanceKm, truckType) {
  const rate = OPERATING_COST_PER_KM[truckType] || 22;
  return Number((distanceKm * rate).toFixed(2));
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
    queueNewTruckAutomation({ truckId: truck.id, dealerId: req.user.id, requestId: req.requestId })
      .catch((e) => {
        logger.warn(`Queue unavailable, running inline truck automation: ${e.message}`);
        return dealerMlAutomationService.generateForNewTruck(truck.id, req.user.id, req.requestId);
      })
      .catch((e) => logger.warn(`Dealer ML automation failed after truck add: ${e.message}`));
    res.status(201).json({ success: true, truck });
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

// Dealer: list best-profit shipment opportunities using live Prisma data.
async function getDealerProfitOpportunities(req, res, next) {
  try {
    const [dealerTrucks, openShipments] = await Promise.all([
      prisma.truck.findMany({
        where: { dealerId: req.user.id, status: 'AVAILABLE', availability: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shipment.findMany({
        where: {
          status: { in: ['PENDING', 'OPTIMIZED'] },
          bookings: {
            none: { status: { in: ACTIVE_BOOKING_STATUSES } },
          },
        },
        select: {
          id: true,
          weightKg: true,
          volumeM3: true,
          pickupLocation: true,
          destination: true,
          deadline: true,
          description: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (dealerTrucks.length === 0) {
      return res.json({ success: true, opportunities: [], meta: { trucksConsidered: 0, shipmentsConsidered: openShipments.length } });
    }

    const opportunities = [];

    for (const shipment of openShipments) {
      if (!hasValidCoordinates(shipment.pickupLocation) || !hasValidCoordinates(shipment.destination)) continue;

      const { distanceKm } = calculateRoute(shipment.pickupLocation, shipment.destination);
      let best = null;

      for (const truck of dealerTrucks) {
        const weightOk = truck.capacityKg >= shipment.weightKg;
        const volumeOk = shipment.volumeM3 == null || truck.capacityM3 == null || truck.capacityM3 >= shipment.volumeM3;
        if (!weightOk || !volumeOk || !isRouteCompatible(truck, shipment)) continue;

        const pricing = pricingService.calculate({
          distanceKm,
          weightKg: shipment.weightKg,
          truckType: truck.truckType,
          dealerPricePerKm: truck.pricePerKm,
        });
        const operatingCost = estimateOperatingCost(distanceKm, truck.truckType);
        const estimatedProfit = Number((pricing.total - operatingCost).toFixed(2));

        if (!best || estimatedProfit > best.estimatedProfit) {
          best = {
            truckId: truck.id,
            registrationNo: truck.registrationNo,
            truckType: truck.truckType,
            distanceKm: pricing.distanceKm,
            estimatedRevenue: pricing.total,
            estimatedOperatingCost: operatingCost,
            estimatedProfit,
            pricing,
          };
        }
      }

      if (best) {
        opportunities.push({
          shipment: {
            id: shipment.id,
            weightKg: shipment.weightKg,
            volumeM3: shipment.volumeM3,
            pickupLocation: shipment.pickupLocation,
            destination: shipment.destination,
            deadline: shipment.deadline,
            description: shipment.description,
            status: shipment.status,
          },
          bestMatch: best,
        });
      }
    }

    opportunities.sort((a, b) => b.bestMatch.estimatedProfit - a.bestMatch.estimatedProfit);
    res.json({
      success: true,
      opportunities,
      meta: {
        trucksConsidered: dealerTrucks.length,
        shipmentsConsidered: openShipments.length,
        profitableMatches: opportunities.length,
      },
    });
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
    if (routeTo)   where.routeTo   = { contains: routeTo,   mode: 'insensitive' };

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
    if (truckType    !== undefined) data.truckType    = truckType;
    if (capacityKg   !== undefined) data.capacityKg   = capacityKg;
    if (capacityM3   !== undefined) data.capacityM3   = capacityM3;
    if (routeFrom    !== undefined) data.routeFrom    = routeFrom;
    if (routeTo      !== undefined) data.routeTo      = routeTo;
    if (pricePerKm   !== undefined) data.pricePerKm   = pricePerKm;
    if (availability !== undefined) data.availability = availability;
    if (status       !== undefined) data.status       = status;

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
    const payload = { truckId: truck.id, location: updated.currentLocation };
    io.to(`truck:${truck.id}`).emit('truck:location', payload);
    io.to(`user:${truck.dealerId}`).emit('truck:location', payload);

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
  getDealerProfitOpportunities,
  getAllTrucks,
  getAvailableTrucks,
  getTruck,
  updateTruck,
  updateTruckLocation,
  deleteTruck,
};
