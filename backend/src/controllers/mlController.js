/**
 * controllers/mlController.js
 * Thin layer: uses asyncHandler, propagates requestId.
 */

const mlService = require('../services/mlService');
const { prisma } = require('../config/db');
const { asyncHandler, AppError } = require('../helpers/errors');
const logger = require('../config/logger');
const dealerMlAutomationService = require('../services/dealerMlAutomationService');
const { queueMlPredictionJob } = require('../queues/mlQueue');

function _haversineKm(from, to) {
  const toNum = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizePair = (point = {}) => {
    let lat = toNum(point?.lat);
    let lng = toNum(point?.lng);
    if (lat === null || lng === null) return null;

    // Auto-correct only when lat is clearly invalid and lng is lat-like.
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      [lat, lng] = [lng, lat];
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  };

  const calc = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const a = normalizePair(from);
  const b = normalizePair(to);
  if (!a || !b) return 0;

  // Deterministic result from normalized coordinates only.
  const distance = calc(a, b);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  return Number(distance.toFixed(1));
}

// ── Health / info ─────────────────────────────────────────────────────────────
const getMlHealth = asyncHandler(async (req, res) => {
  try {
    const [health, readyz] = await Promise.allSettled([
      mlService.getHealth(req.requestId),
      mlService.getReadyz(req.requestId),
    ]);
    res.json({
      success: true,
      circuit: mlService.getCircuitStatus(),
      metrics: mlService.getMetricsSummary(),
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

// ── Unified predict ───────────────────────────────────────────────────────────
const predictAll = asyncHandler(async (req, res) => {
  const { prediction_type, ...payload } = req.body;
  const VALID = ['truck', 'delivery', 'delay', 'fuel', 'cluster', 'cargo'];

  if (!prediction_type) throw AppError.badRequest('prediction_type is required');

  const pt = prediction_type.toLowerCase();
  if (!VALID.includes(pt)) {
    throw AppError.unprocessable(`Unknown prediction_type. Valid: ${VALID.join(', ')}`);
  }

  const result = await mlService.predictAll(pt, payload, req.requestId);
  res.json({ success: true, prediction_type: pt, result });
});

// ── Truck recommendation ──────────────────────────────────────────────────────
const getTruckRecommendation = asyncHandler(async (req, res) => {
  const { weight_kg, volume_m3, distance_km, cargo_type, priority } = req.query;
  const result = await mlService.predictTruckRecommendation(
    { weight_kg: +weight_kg, volume_m3: +volume_m3, distance_km: +distance_km, cargo_type, priority },
    req.requestId,
  );
  res.json({ success: true, result });
});

// ── Delivery time for a DB shipment ──────────────────────────────────────────
const predictDeliveryTime = asyncHandler(async (req, res) => {
  const shipment = await _getShipmentOrThrow(req.params.shipmentId, req.user);
  const latestBooking = shipment.bookings?.[0] ?? null;
  const truckType = latestBooking?.truck?.truckType || 'CONTAINER_20FT';
  const queryDistanceKm = Number(req.query.distance_km);
  const shipmentDistanceKm = _haversineKm(shipment.pickupLocation, shipment.destination);
  const distanceKm =
    (Number.isFinite(queryDistanceKm) && queryDistanceKm > 0 ? queryDistanceKm : null) ||
    shipmentDistanceKm ||
    latestBooking?.distanceKm ||
    1;

  const result = await mlService.predictDeliveryTime({
    weight_kg: shipment.weightKg,
    distance_km: distanceKm,
    truck_type: truckType,
    traffic_condition: req.query.traffic || 'MODERATE',
    weather_condition: req.query.weather || 'CLEAR',
  }, req.requestId);

  await prisma.$transaction([
    prisma.prediction.deleteMany({ where: { shipmentId: shipment.id, type: 'ETA_HOURS' } }),
    prisma.prediction.create({
      data: {
        shipmentId: shipment.id,
        type: 'ETA_HOURS',
        value: result.predicted_hours ?? 0,
        confidence: result.confidence ?? null,
        modelVersion: result.fallback ? 'fallback' : '2.1.0',
        modelName: result.model_name || 'delivery_eta',
        source: result.fallback ? 'heuristic' : (result.source || 'ml_service'),
        latencyMs: result.latency_ms ?? null,
      },
    }),
  ]);

  res.json({ success: true, result });
});

// ── Cluster shipments ─────────────────────────────────────────────────────────
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

  const mlResult = await mlService.clusterShipments(formatted, req.requestId);

  // Normalize ML output into a stable API contract for the frontend.
  // Frontend expects: cluster.count, cluster.totalWeight, cluster.center.{lat,lng}
  const normalizedClusters = (mlResult?.clusters || []).map((cluster) => {
    const shipmentCount = cluster?.shipment_count ?? cluster?.count ?? (cluster?.shipments?.length || 0);
    const totalWeightKg = cluster?.total_weight_kg ?? cluster?.totalWeight ?? null;
    const centerLat = cluster?.center_latitude ?? cluster?.center?.lat ?? null;
    const centerLng = cluster?.center_longitude ?? cluster?.center?.lng ?? null;

    return {
      ...cluster,
      count: shipmentCount,
      totalWeight: totalWeightKg,
      center: {
        lat: Number.isFinite(Number(centerLat)) ? Number(centerLat) : null,
        lng: Number.isFinite(Number(centerLng)) ? Number(centerLng) : null,
      },
    };
  });

  res.json({
    success: true,
    result: {
      ...mlResult,
      clusters: normalizedClusters,
    },
  });
});

// ── Delay risk for a DB shipment ──────────────────────────────────────────────
const predictDelayRisk = asyncHandler(async (req, res) => {
  const shipment = await _getShipmentOrThrow(req.params.shipmentId, req.user);
  const latestBooking = shipment.bookings?.[0] ?? null;
  const truckType = latestBooking?.truck?.truckType || 'CONTAINER_20FT';
  const queryDistanceKm = Number(req.query.distance_km);
  const shipmentDistanceKm = _haversineKm(shipment.pickupLocation, shipment.destination);
  const distanceKm =
    (Number.isFinite(queryDistanceKm) && queryDistanceKm > 0 ? queryDistanceKm : null) ||
    shipmentDistanceKm ||
    latestBooking?.distanceKm ||
    1;

  // predictDelayRisk now has a heuristic fallback — it never throws
  const result = await mlService.predictDelayRisk({
    distance_km: distanceKm,
    weight_kg: shipment.weightKg,
    truck_type: truckType,
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
        modelName: result.model_name || 'delay_risk',
        source: result.fallback ? 'heuristic' : (result.source || 'ml_service'),
        latencyMs: result.latency_ms ?? null,
      },
    }),
  ]);

  res.json({ success: true, result });
});

// ── Fuel estimate ─────────────────────────────────────────────────────────────
const estimateFuel = asyncHandler(async (req, res) => {
  const { distance_km, weight_kg, truck_type } = req.query;
  const raw = await mlService.estimateFuel(
    { distance_km: +distance_km, weight_kg: +weight_kg, truck_type },
    req.requestId,
  );
  const result = {
    ...raw,
    estimated_liters: raw?.estimated_liters ?? raw?.fuel_liters ?? raw?.fuelLiters ?? 0,
    estimated_cost_inr: raw?.estimated_cost_inr ?? raw?.estimated_cost ?? raw?.cost_inr ?? raw?.costInr ?? raw?.cost ?? 0,
    co2_kg: raw?.co2_kg ?? raw?.co2_emissions_kg ?? raw?.co2Kg ?? 0,
    consumption_per_100km: raw?.consumption_per_100km ?? raw?.consumptionPer100km ?? null,
  };
  res.json({ success: true, result });
});

// ── Cargo optimization ────────────────────────────────────────────────────────
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

// ── Refresh predictions for an existing booking (dealer-centric) ─────────────
const predictForBooking = asyncHandler(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    select: { id: true, shipmentId: true, truckId: true, warehouseId: true, dealerId: true },
  });
  if (!booking) throw AppError.notFound('Booking not found');

  const allowed =
    req.user.role === 'ADMIN' ||
    (req.user.role === 'DEALER' && booking.dealerId === req.user.id) ||
    (req.user.role === 'WAREHOUSE' && booking.warehouseId === req.user.id);
  if (!allowed) throw AppError.forbidden();

  await queueMlPredictionJob({
    shipmentId: booking.shipmentId,
    truckId: booking.truckId,
    requestId: req.requestId,
  }).catch(() => dealerMlAutomationService.generateShipmentTruckPredictions(
    booking.shipmentId,
    booking.truckId,
    req.requestId,
    req.app.get('io'),
  ));

  const predictions = await prisma.prediction.findMany({
    where: {
      shipmentId: booking.shipmentId,
      type: { in: ['ETA_HOURS', 'DELAY_RISK_PERCENT', 'FUEL_ESTIMATE_LITERS', 'CO2_KG'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, bookingId: booking.id, shipmentId: booking.shipmentId, predictions, conditions });
});

const predictForBookingsBatch = asyncHandler(async (req, res) => {
  const bookingIds = Array.isArray(req.body?.bookingIds) ? req.body.bookingIds : [];
  if (bookingIds.length === 0) throw AppError.badRequest('bookingIds is required');
  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    select: { id: true, shipmentId: true, truckId: true, warehouseId: true, dealerId: true },
  });
  const allowed = bookings.filter((booking) =>
    req.user.role === 'ADMIN' ||
    (req.user.role === 'DEALER' && booking.dealerId === req.user.id) ||
    (req.user.role === 'WAREHOUSE' && booking.warehouseId === req.user.id));
  await Promise.allSettled(allowed.map((booking) => queueMlPredictionJob({
    shipmentId: booking.shipmentId,
    truckId: booking.truckId,
    requestId: req.requestId,
  }).catch(() => dealerMlAutomationService.generateShipmentTruckPredictions(
    booking.shipmentId,
    booking.truckId,
    req.requestId,
    req.app.get('io'),
  ))));
  res.json({ success: true, queued: allowed.length, requested: bookingIds.length });
});

// ── Shared helper ─────────────────────────────────────────────────────────────
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
  predictForBooking,
  predictForBookingsBatch,
};
