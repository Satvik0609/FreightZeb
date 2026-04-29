const { prisma } = require('../config/db');
const optimizationService = require('../services/optimizationService');
const mlService = require('../services/mlService');
const logger = require('../config/logger');
const { parsePagination } = require('../helpers/pagination');
const {
  emitShipmentCreated,
  emitShipmentStatusUpdate,
  emitShipmentPredictionsUpdated,
  emitShipmentOptimized,
} = require('../helpers/realtime');

function inferCargoType(requirements) {
  if (requirements?.tempControlled) return 'REFRIGERATED';
  if (requirements?.hazardous) return 'HAZARDOUS';
  if (requirements?.fragile) return 'FRAGILE';
  return 'GENERAL';
}

function getPredictionModelVersion(result) {
  const source = result?.source || (result?.fallback ? 'heuristic_fallback' : 'ml_service');
  const reason = result?.fallback ? `reason=${(result?.fallback_reason || 'service_error').replace(/\s+/g, '_')}` : 'reason=none';
  return `${result?.fallback ? 'fallback-heuristic' : '2.1.0'}|source=${source}|${reason}`;
}

function shipmentDistanceKm(pickupLocation, destination) {
  const lat1 = Number(pickupLocation?.lat);
  const lng1 = Number(pickupLocation?.lng);
  const lat2 = Number(destination?.lat);
  const lng2 = Number(destination?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

async function buildMlPredictions({ shipment, distanceKm, truckType, truckRecommendation, requestId }) {
  const [etaResult, fuelResult, delayResult] = await Promise.all([
    mlService.predictDeliveryTime({
      weight_kg: shipment.weightKg,
      distance_km: distanceKm,
      truck_type: truckType,
      traffic_condition: 'MODERATE',
      weather_condition: 'CLEAR',
    }, requestId),
    mlService.estimateFuel({
      distance_km: distanceKm,
      weight_kg: shipment.weightKg,
      truck_type: truckType,
    }, requestId),
    mlService.predictDelayRisk({
      distance_km: distanceKm,
      weight_kg: shipment.weightKg,
      truck_type: truckType,
      weather_condition: 'CLEAR',
      traffic_condition: 'MODERATE',
      time_of_day: shipment.deadline ? 'EVENING' : 'AFTERNOON',
    }, requestId),
  ]);

  const predictions = [];
  if (etaResult?.predicted_hours != null) {
    predictions.push({
      shipmentId: shipment.id,
      type: 'ETA_HOURS',
      value: etaResult.predicted_hours,
      confidence: etaResult.confidence ?? null,
      modelVersion: getPredictionModelVersion(etaResult),
    });
  }
  if (fuelResult?.estimated_liters != null) {
    predictions.push({
      shipmentId: shipment.id,
      type: 'FUEL_ESTIMATE_LITERS',
      value: fuelResult.estimated_liters,
      confidence: fuelResult.confidence ?? null,
      modelVersion: getPredictionModelVersion(fuelResult),
    });
  }
  const co2Kg = fuelResult?.co2_emissions_kg ?? fuelResult?.co2_kg ?? mlService.estimateCo2(distanceKm, truckType);
  if (co2Kg != null) {
    predictions.push({
      shipmentId: shipment.id,
      type: 'CO2_KG',
      value: co2Kg,
      confidence: fuelResult?.confidence ?? null,
      modelVersion: fuelResult?.fallback ? 'fallback-heuristic' : 'derived-from-fuel-model',
    });
  }
  if (delayResult?.delay_probability != null) {
    predictions.push({
      shipmentId: shipment.id,
      type: 'DELAY_RISK_PERCENT',
      value: delayResult.delay_probability,
      confidence: delayResult.confidence ?? null,
      modelVersion: getPredictionModelVersion(delayResult),
    });
  }
  if (truckRecommendation) {
    predictions.push({
      shipmentId: shipment.id,
      type: 'RECOMMENDED_TRUCK_SCORE',
      value: truckRecommendation.confidence ?? 0.8,
      confidence: truckRecommendation.confidence ?? null,
      modelVersion: getPredictionModelVersion(truckRecommendation),
    });
  }

  return predictions;
}

// ── Warehouse: create shipment ───────────────────────────────────────────────
async function createShipment(req, res, next) {
  try {
    const { weightKg, volumeM3, boxes, pickupLocation, destination, deadline, description, requirements } = req.body;
    const io = req.app.get('io');

    const shipment = await prisma.shipment.create({
      data: {
        warehouseId: req.user.id,
        weightKg,
        volumeM3,
        boxes,
        pickupLocation,
        destination,
        deadline: deadline ? new Date(deadline) : null,
        description,
        requirements,
        status: 'PENDING',
      },
    });

    logger.info(`Shipment created: ${shipment.id} by ${req.user.id}`);

    // Emit real-time creation event immediately
    emitShipmentCreated(io, {
      shipmentId: shipment.id,
      warehouseId: shipment.warehouseId,
      shipment,
      source: 'shipment:create',
    });

    res.status(201).json({ success: true, shipment });

    // ── Async ML predictions after response is sent ──────────────────────────
    setImmediate(async () => {
      try {
        const cargo_type = inferCargoType(requirements);
        const distanceKm = shipmentDistanceKm(pickupLocation, destination);

        if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
          logger.warn(`Skipping auto-predictions for shipment ${shipment.id}: invalid distance`);
          return;
        }

        const truckRec = await mlService.predictTruckRecommendation({
          weight_kg: weightKg,
          volume_m3: volumeM3 ?? 0.001,
          distance_km: distanceKm,
          cargo_type,
          priority: deadline ? 'URGENT' : 'NORMAL',
        });
        const recommendedTruckType = truckRec?.recommended_truck || 'CONTAINER_20FT';
        const predictions = await buildMlPredictions({
          shipment,
          distanceKm,
          truckType: recommendedTruckType,
          truckRecommendation: truckRec,
          requestId: req.id,
        });

        if (predictions.length > 0) {
          await prisma.prediction.createMany({ data: predictions });
          logger.info(`Auto-predictions saved for shipment ${shipment.id}: ${predictions.map(p => p.type).join(', ')}`);

          emitShipmentPredictionsUpdated(io, {
            shipmentId: shipment.id,
            warehouseId: shipment.warehouseId,
            predictions,
            source: 'shipment:create',
            trigger: 'auto',
          });
        }
      } catch (mlErr) {
        logger.warn(`Auto-prediction failed for shipment ${shipment.id}: ${mlErr.message}`);
      }
    });
  } catch (err) {
    next(err);
  }
}

// ── Warehouse: list own shipments ────────────────────────────────────────────
async function getMyShipments(req, res, next) {
  try {
    const { status, search, dateFrom, dateTo } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const where = { warehouseId: req.user.id };

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          bookings: { include: { truck: true } },
          predictions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), shipments });
  } catch (err) {
    next(err);
  }
}

// ── All roles: browse bookable shipments (DEALER sees these to know what's available) ──
async function getAvailableShipments(req, res, next) {
  try {
    const { status, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    // Default to bookable statuses unless a specific status is requested
    const bookableStatuses = ['PENDING', 'OPTIMIZED'];
    const where = {
      status: status ? status : { in: bookableStatuses },
    };
    if (search) {
      where.OR = [{ description: { contains: search, mode: 'insensitive' } }];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, company: true } },
          bookings: { include: { truck: true }, take: 1, orderBy: { createdAt: 'desc' } },
          predictions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), shipments });
  } catch (err) {
    next(err);
  }
}

// ── Admin: all shipments ─────────────────────────────────────────────────────
async function getAllShipments(req, res, next) {
  try {
    const { status, warehouseId, dateFrom, dateTo } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};

    if (status) where.status = status;
    if (warehouseId) where.warehouseId = warehouseId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, email: true, company: true } },
          bookings: { include: { truck: true } },
          predictions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), shipments });
  } catch (err) {
    next(err);
  }
}

// ── Get single shipment ──────────────────────────────────────────────────────
async function getShipment(req, res, next) {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        warehouse: { select: { id: true, name: true, email: true, company: true } },
        bookings: {
          include: {
            truck: true,
            dealer: { select: { id: true, name: true, email: true, phone: true } },
            trackingLogs: { orderBy: { timestamp: 'desc' }, take: 1 },
          },
        },
        predictions: true,
      },
    });

    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

    const isOwner = shipment.warehouseId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    const isBookableForDealer = req.user.role === 'DEALER' && ['PENDING', 'OPTIMIZED'].includes(shipment.status);
    const isDealerOnBooking = req.user.role === 'DEALER' && shipment.bookings?.some((booking) => booking.dealerId === req.user.id);
    if (!isOwner && !isAdmin && !isBookableForDealer && !isDealerOnBooking) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.json({ success: true, shipment });
  } catch (err) {
    next(err);
  }
}

// ── Warehouse: cancel shipment ───────────────────────────────────────────────
async function cancelShipment(req, res, next) {
  try {
    const NON_TERMINAL = ['REQUESTED', 'APPROVED', 'ASSIGNED'];
    const io = req.app.get('io');

    const updated = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: req.params.id },
        select: { id: true, warehouseId: true, status: true },
      });

      if (!shipment) {
        const err = new Error('Shipment not found');
        err.statusCode = 404;
        throw err;
      }

      if (shipment.warehouseId !== req.user.id && req.user.role !== 'ADMIN') {
        const err = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
      }

      if (['DELIVERED', 'CANCELLED', 'IN_TRANSIT'].includes(shipment.status)) {
        const err = new Error(`Cannot cancel a ${shipment.status} shipment`);
        err.statusCode = 400;
        throw err;
      }

      // Find all open bookings for this shipment
      const openBookings = await tx.booking.findMany({
        where: { shipmentId: shipment.id, status: { in: NON_TERMINAL } },
        select: { id: true, truckId: true },
      });

      const openBookingIds = openBookings.map((b) => b.id);
      const truckIds = [...new Set(openBookings.map((b) => b.truckId))];

      if (openBookingIds.length > 0) {
        // Cancel all open bookings
        await tx.booking.updateMany({
          where: { id: { in: openBookingIds } },
          data: { status: 'CANCELLED' },
        });
        // Release all affected trucks
        await tx.truck.updateMany({
          where: { id: { in: truckIds } },
          data: { status: 'AVAILABLE', availability: true },
        });
      }

      return tx.shipment.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
      });
    });

    logger.info(`Shipment ${updated.id} cancelled by ${req.user.id}`);
    emitShipmentStatusUpdate(io, {
      shipmentId: updated.id,
      warehouseId: updated.warehouseId,
      status: updated.status,
      source: 'shipment:cancel',
    });
    res.json({ success: true, shipment: updated });
  } catch (err) {
    next(err);
  }
}

// ── Run optimization + save predictions ─────────────────────────────────────
async function runOptimization(req, res, next) {
  try {
    const io = req.app.get('io');
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

    if (shipment.warehouseId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (shipment.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot optimize a cancelled shipment' });
    }

    const results = await optimizationService.run(shipment);
    let predictions = [];
    // Use the ML truck recommendation to promote the best-fitting candidate before
    // persisting ETA/fuel predictions derived from that recommendation.
    if (results.results.length > 0) {
      const distanceKm = results.distanceKm;
      const cargo_type = inferCargoType(shipment.requirements);

      const truckRecommendation = await mlService.predictTruckRecommendation({
        weight_kg: shipment.weightKg,
        volume_m3: shipment.volumeM3 ?? 0.001,
        distance_km: distanceKm,
        cargo_type,
        priority: shipment.deadline ? 'URGENT' : 'NORMAL',
      });

      if (truckRecommendation?.recommended_truck) {
        results.results = [...results.results].sort((a, b) => {
          const aBoost = a.truckType === truckRecommendation.recommended_truck ? 1 : 0;
          const bBoost = b.truckType === truckRecommendation.recommended_truck ? 1 : 0;
          if (aBoost !== bBoost) return bBoost - aBoost;
          return b.score - a.score;
        }).map((candidate) => ({
          ...candidate,
          mlRecommended: candidate.truckType === truckRecommendation.recommended_truck,
          recommendationConfidence: truckRecommendation.confidence ?? null,
          recommendationSource: truckRecommendation.source || 'unknown',
        }));
      }

      const top = results.results[0];

      predictions = await buildMlPredictions({
        shipment,
        distanceKm,
        truckType: top.truckType,
        truckRecommendation: {
          ...(truckRecommendation || {}),
          confidence: truckRecommendation?.confidence ?? top.score,
        },
        requestId: req.id,
      });

      if (predictions.length > 0) {
        // Delete old predictions for this shipment before inserting new ones
        await prisma.prediction.deleteMany({ where: { shipmentId: shipment.id } });
        await prisma.prediction.createMany({ data: predictions });
      }
    }

    const updatedShipment = results.results.length > 0
      ? await prisma.shipment.update({
        where: { id: req.params.id },
        data: { status: 'OPTIMIZED' },
      })
      : shipment;

    logger.info(`Optimization complete for shipment ${shipment.id}`);
    emitShipmentPredictionsUpdated(io, {
      shipmentId: shipment.id,
      warehouseId: shipment.warehouseId,
      predictions,
      source: 'shipment:optimize',
      trigger: 'optimization',
    });
    emitShipmentOptimized(io, {
      shipmentId: shipment.id,
      warehouseId: shipment.warehouseId,
      predictions,
      results: results.results,
    });
    emitShipmentStatusUpdate(io, {
      shipmentId: updatedShipment.id,
      warehouseId: updatedShipment.warehouseId,
      previousStatus: shipment.status,
      status: updatedShipment.status,
      source: 'shipment:optimize',
    });
    res.json({
      success: true,
      shipmentId: shipment.id,
      ml_integration: {
        truck_recommendation: results.results[0]?.recommendationSource || null,
        eta_source: results.results.length > 0 ? 'integrated' : null,
      },
      results,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createShipment,
  getMyShipments,
  getAllShipments,
  getAvailableShipments,
  getShipment,
  cancelShipment,
  runOptimization,
};
