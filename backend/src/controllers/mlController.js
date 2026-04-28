/**
 * controllers/mlController.js
 * Thin layer: uses asyncHandler, propagates requestId.
 */

const mlService = require('../services/mlService');
const { prisma } = require('../config/db');
const { asyncHandler, AppError } = require('../helpers/errors');
const { emitShipmentPredictionsUpdated } = require('../helpers/realtime');
const logger = require('../config/logger');

// Health / info
const getMlHealth = asyncHandler(async (req, res) => {
  try {
    const [health, readyz] = await Promise.allSettled([
      mlService.getHealth(req.requestId),
      mlService.getReadyz(req.requestId),
    ]);
    res.json({
      success: true,
      circuit: mlService.getCircuitStatus(),
      health: health.status === 'fulfilled' ? health.value : { error: health.reason?.message },
      readyz: readyz.status === 'fulfilled' ? readyz.value : { error: readyz.reason?.message },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      code: 'ML_UNAVAILABLE',
      circuit: mlService.getCircuitStatus(),
    });
  }
});

const getModelsInfo = asyncHandler(async (req, res) => {
  const info = await mlService.getModelsInfo(req.requestId);
  res.json({ success: true, ...info });
});

// Unified predict
const predictAll = asyncHandler(async (req, res) => {
  const { prediction_type, ...payload } = req.body;
  const VALID = ['truck', 'delivery', 'delay', 'fuel', 'cluster', 'cargo'];

  if (!prediction_type) throw AppError.badRequest('prediction_type is required');

  const pt = prediction_type.toLowerCase();
  if (!VALID.includes(pt)) {
    throw AppError.unprocessable(`Unknown prediction_type. Valid: ${VALID.join(', ')}`);
  }

  try {
    const result = await mlService.predictAll(pt, payload, req.requestId);
    res.json({ success: true, prediction_type: pt, result });
  } catch (err) {
    if (pt === 'cargo') {
      logger.warn(`Unified cargo prediction failed: ${err.message}`);
      return res.status(503).json({
        success: false,
        code: 'ML_UNAVAILABLE',
        message: 'Cargo optimization requires the ML service to be available.',
      });
    }
    throw err;
  }
});

// Truck recommendation
const getTruckRecommendation = asyncHandler(async (req, res) => {
  const { weight_kg, volume_m3, distance_km, cargo_type, priority } = req.query;
  const result = await mlService.predictTruckRecommendation(
    { weight_kg: +weight_kg, volume_m3: +volume_m3, distance_km: +distance_km, cargo_type, priority },
    req.requestId,
  );
  res.json({ success: true, result });
});

// Delivery time for a DB shipment
const predictDeliveryTime = asyncHandler(async (req, res) => {
  const shipment = await _getShipmentOrThrow(req.params.shipmentId, req.user);
  const booking = shipment.bookings?.[0];
  const distanceKm = booking?.distanceKm || _inferDistanceKm(shipment);
  const truckType = booking?.truck?.truckType || req.query.truck_type || 'CONTAINER_20FT';

  const result = await mlService.predictDeliveryTime({
    weight_kg: shipment.weightKg,
    distance_km: distanceKm,
    truck_type: truckType,
    traffic_condition: req.query.traffic || 'MODERATE',
    weather_condition: req.query.weather || 'CLEAR',
  }, req.requestId);

  const [, savedPrediction] = await prisma.$transaction([
    prisma.prediction.deleteMany({ where: { shipmentId: shipment.id, type: 'ETA_HOURS' } }),
    prisma.prediction.create({
      data: {
        shipmentId: shipment.id,
        type: 'ETA_HOURS',
        value: result.predicted_hours ?? 0,
        confidence: result.confidence ?? null,
        modelVersion: result.fallback ? 'fallback' : '2.1.0',
      },
    }),
  ]);

  emitShipmentPredictionsUpdated(req.app.get('io'), {
    shipmentId: shipment.id,
    warehouseId: shipment.warehouseId,
    predictions: [savedPrediction],
    source: 'ml:predict-delivery',
    trigger: 'delivery_prediction',
  });

  res.json({ success: true, result });
});

// Cluster shipments
const clusterShipments = asyncHandler(async (req, res) => {
  if (req.user.role === 'DEALER') throw AppError.forbidden();

  const where = { status: req.query.status || 'PENDING' };
  if (req.user.role === 'WAREHOUSE') where.warehouseId = req.user.id;

  const shipments = await prisma.shipment.findMany({
    where,
    select: { id: true, destination: true, weightKg: true, volumeM3: true },
  });

  if (shipments.length < 2) {
    return res.json({ success: true, message: 'Not enough shipments', n_clusters: 0, clusters: [] });
  }

  const formatted = shipments
    .map((s) => ({
      id: s.id,
      latitude: s.destination?.lat,
      longitude: s.destination?.lng,
      weight_kg: s.weightKg,
      volume_m3: s.volumeM3 ?? 0,
    }))
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

  if (formatted.length < 2) {
    return res.json({ success: true, message: 'Not enough geocoded shipments', n_clusters: 0, clusters: [] });
  }

  const result = await mlService.clusterShipments(formatted, req.requestId);
  res.json({ success: true, result });
});

// Delay risk for a DB shipment
const predictDelayRisk = asyncHandler(async (req, res) => {
  const shipment = await _getShipmentOrThrow(req.params.shipmentId, req.user);
  const booking = shipment.bookings?.[0];
  if (!booking) throw AppError.badRequest('Shipment has no booking yet');

  const result = await mlService.predictDelayRisk({
    distance_km: booking.distanceKm || 0,
    weight_kg: shipment.weightKg,
    truck_type: booking.truck?.truckType || 'CONTAINER_20FT',
    weather_condition: req.query.weather || 'CLEAR',
    traffic_condition: req.query.traffic || 'MODERATE',
    time_of_day: req.query.time_of_day || 'AFTERNOON',
  }, req.requestId);

  await prisma.$transaction([
    prisma.prediction.deleteMany({ where: { shipmentId: shipment.id, type: 'DELAY_RISK_PERCENT' } }),
    prisma.prediction.create({
      data: {
        shipmentId: shipment.id,
        type: 'DELAY_RISK_PERCENT',
        value: result.delay_probability ?? 0,
        confidence: result.confidence ?? null,
        modelVersion: result.fallback ? 'fallback' : '2.1.0',
      },
    }),
  ]);

  res.json({ success: true, result });
});

// Fuel estimate
const estimateFuel = asyncHandler(async (req, res) => {
  const { distance_km, weight_kg, truck_type } = req.query;
  const result = await mlService.estimateFuel(
    { distance_km: +distance_km, weight_kg: +weight_kg, truck_type },
    req.requestId,
  );
  res.json({ success: true, result });
});

// Cargo optimization
const optimizeCargo = asyncHandler(async (req, res) => {
  const { truck_capacity_kg, truck_capacity_m3, items } = req.body;
  try {
    const result = await mlService.optimizeCargo({ truck_capacity_kg, truck_capacity_m3, items }, req.requestId);
    res.json({ success: true, result });
  } catch (err) {
    logger.warn(`optimizeCargo ML call failed: ${err.message}`);
    res.status(503).json({
      success: false,
      code: 'ML_UNAVAILABLE',
      message: 'Cargo optimization requires the ML service to be available.',
    });
  }
});

// Shared helper
async function _getShipmentOrThrow(shipmentId, user) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      bookings: {
        include: { truck: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!shipment) throw AppError.notFound('Shipment not found');

  const allowed =
    user.role === 'ADMIN' ||
    (user.role === 'WAREHOUSE' && shipment.warehouseId === user.id) ||
    (user.role === 'DEALER' && shipment.bookings.some((b) => b.dealerId === user.id));

  if (!allowed) throw AppError.forbidden();
  return shipment;
}

function _inferDistanceKm(shipment) {
  const origin = shipment.pickupLocation || {};
  const destination = shipment.destination || {};
  const lat1 = Number(origin.lat);
  const lon1 = Number(origin.lng);
  const lat2 = Number(destination.lat);
  const lon2 = Number(destination.lng);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return parseFloat((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

module.exports = {
  getMlHealth,
  getModelsInfo,
  predictAll,
  getTruckRecommendation,
  predictDeliveryTime,
  clusterShipments,
  predictDelayRisk,
  estimateFuel,
  optimizeCargo,
};
