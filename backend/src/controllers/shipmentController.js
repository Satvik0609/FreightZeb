const { prisma } = require('../config/db');
const optimizationService = require('../services/optimizationService');
const mlService = require('../services/mlService');
const logger = require('../config/logger');
const { parsePagination } = require('../helpers/pagination');

function inferCargoType(requirements) {
  if (requirements?.tempControlled) return 'REFRIGERATED';
  if (requirements?.hazardous) return 'HAZARDOUS';
  if (requirements?.fragile) return 'FRAGILE';
  return 'GENERAL';
}

function getPredictionModelVersion(result) {
  return result?.fallback ? 'fallback-heuristic' : '2.0.0';
}

// ── Warehouse: create shipment ───────────────────────────────────────────────
async function createShipment(req, res, next) {
  try {
    const { weightKg, volumeM3, boxes, pickupLocation, destination, deadline, description, requirements } = req.body;

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

    // Broadcast to all dealers so their shipment list auto-refreshes
    const io = req.app.get('io');
    if (io) {
      io.emit('shipment:new', {
        shipmentId: shipment.id,
        warehouseId: req.user.id,
        origin: pickupLocation?.city || pickupLocation?.address || null,
        destination: destination?.city || destination?.address || null,
        weightKg,
        status: 'PENDING',
        createdAt: shipment.createdAt,
      });
    }

    logger.info(`Shipment created: ${shipment.id} by ${req.user.id}`);
    res.status(201).json({ success: true, shipment });
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

// ── Dealer: list available shipments (PENDING / OPTIMIZED) ──────────────────
async function getAvailableShipments(req, res, next) {
  try {
    const { status, search, dateFrom, dateTo } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      status: status ? status : { in: ['PENDING', 'OPTIMIZED'] },
    };

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
          warehouse: { select: { id: true, name: true, company: true } },
          predictions: true,
          bookings: {
            where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
            select: { id: true, status: true, dealerId: true },
          },
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
    if (!isOwner && !isAdmin) {
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
    res.json({ success: true, shipment: updated });
  } catch (err) {
    next(err);
  }
}

// ── Run optimization + save predictions ─────────────────────────────────────
async function runOptimization(req, res, next) {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

    if (shipment.warehouseId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (shipment.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot optimize a cancelled shipment' });
    }

    const results = await optimizationService.run(shipment);

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

      const [etaResult, fuelResult] = await Promise.all([
        mlService.predictDeliveryTime({
          weight_kg: shipment.weightKg,
          distance_km: distanceKm,
          truck_type: top.truckType,
        }),
        mlService.estimateFuel({
          distance_km: distanceKm,
          weight_kg: shipment.weightKg,
          truck_type: top.truckType,
        }),
      ]);
      const etaHours = etaResult?.predicted_hours ?? null;
      const fuelLiters = fuelResult?.estimated_liters ?? null;
      const co2Kg = mlService.estimateCo2(distanceKm, top.truckType);

      const predictions = [];
      if (etaHours !== null) {
        predictions.push({
          shipmentId: shipment.id,
          type: 'ETA_HOURS',
          value: etaHours,
          confidence: etaResult?.confidence ?? null,
          modelVersion: getPredictionModelVersion(etaResult),
        });
      }
      if (fuelLiters !== null) {
        predictions.push({
          shipmentId: shipment.id,
          type: 'FUEL_ESTIMATE_LITERS',
          value: fuelLiters,
          confidence: fuelResult?.confidence ?? null,
          modelVersion: getPredictionModelVersion(fuelResult),
        });
      }
      if (co2Kg !== null) {
        predictions.push({
          shipmentId: shipment.id,
          type: 'CO2_KG',
          value: co2Kg,
          modelVersion: 'derived-backend',
        });
      }
      predictions.push({
        shipmentId: shipment.id,
        type: 'RECOMMENDED_TRUCK_SCORE',
        value: top.score,
        confidence: truckRecommendation?.confidence ?? null,
        modelVersion: getPredictionModelVersion(truckRecommendation),
      });

      if (predictions.length > 0) {
        // Delete old predictions for this shipment before inserting new ones
        await prisma.prediction.deleteMany({ where: { shipmentId: shipment.id } });
        await prisma.prediction.createMany({ data: predictions });
      }
    }

    await prisma.shipment.update({ where: { id: req.params.id }, data: { status: 'OPTIMIZED' } });

    logger.info(`Optimization complete for shipment ${shipment.id}`);
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
  getAvailableShipments,
  getAllShipments,
  getShipment,
  cancelShipment,
  runOptimization,
};
