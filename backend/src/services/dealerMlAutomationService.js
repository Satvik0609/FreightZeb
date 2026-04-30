const { prisma } = require('../config/db');
const mlService = require('./mlService');
const { calculateRoute } = require('./routeService');
const logger = require('../config/logger');
const notificationService = require('./notificationService');

const ACTIVE_BOOKING_STATUSES = ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

async function generateShipmentTruckPredictions(shipmentId, truckId, requestId, io = null) {
  const [shipment, truck] = await Promise.all([
    prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, weightKg: true, pickupLocation: true, destination: true },
    }),
    prisma.truck.findUnique({
      where: { id: truckId },
      select: { id: true, truckType: true },
    }),
  ]);
  if (!shipment || !truck || !shipment.pickupLocation || !shipment.destination) return;

  const { distanceKm } = await calculateRoute(shipment.pickupLocation, shipment.destination);

  const [eta, delay, fuel] = await Promise.allSettled([
    mlService.predictDeliveryTime({
      weight_kg: shipment.weightKg,
      distance_km: distanceKm,
      truck_type: truck.truckType,
      traffic_condition: 'MODERATE',
      weather_condition: 'CLEAR',
    }, requestId),
    mlService.predictDelayRisk({
      distance_km: distanceKm,
      weight_kg: shipment.weightKg,
      truck_type: truck.truckType,
      weather_condition: 'CLEAR',
      traffic_condition: 'MODERATE',
      time_of_day: 'AFTERNOON',
    }, requestId),
    mlService.estimateFuel({
      distance_km: distanceKm,
      weight_kg: shipment.weightKg,
      truck_type: truck.truckType,
    }, requestId),
  ]);

  const rows = [];
  if (eta.status === 'fulfilled') {
    const riskType = Number(eta.value?.predicted_hours || 0) > 24 ? 'Elevated ETA due to route conditions' : null;
    rows.push({
      shipmentId: shipment.id,
      type: 'ETA_HOURS',
      value: Number(eta.value?.predicted_hours || 0),
      confidence: eta.value?.confidence ?? null,
      modelVersion: eta.value?.fallback ? 'fallback' : '2.1.0',
      modelName: eta.value?.model_name || 'delivery_eta',
      source: eta.value?.fallback ? 'heuristic' : (eta.value?.source || 'ml_service'),
      latencyMs: eta.value?.latency_ms ?? null,
      explanation: riskType ? { note: riskType } : null,
    });
  }
  if (delay.status === 'fulfilled') {
    const delayValue = Number(delay.value?.delay_probability || 0);
    rows.push({
      shipmentId: shipment.id,
      type: 'DELAY_RISK_PERCENT',
      value: delayValue,
      confidence: delay.value?.confidence ?? null,
      modelVersion: delay.value?.fallback ? 'fallback' : '2.1.0',
      modelName: delay.value?.model_name || 'delay_risk',
      source: delay.value?.fallback ? 'heuristic' : (delay.value?.source || 'ml_service'),
      latencyMs: delay.value?.latency_ms ?? null,
      explanation: delay.value?.factors || null,
    });
    if (io && delayValue >= 70) {
      const booking = await prisma.booking.findFirst({
        where: { shipmentId, truckId, status: { in: ACTIVE_BOOKING_STATUSES } },
        select: { id: true, dealerId: true },
      });
      if (booking) {
        await notificationService.send(io, {
          userId: booking.dealerId,
          type: 'ML_DELAY_RISK_CRITICAL',
          title: 'Critical Delay Risk',
          message: `Booking ${booking.id.slice(-8)} has ${delayValue.toFixed(1)}% delay risk.`,
          meta: { bookingId: booking.id, shipmentId, confidence: delay.value?.confidence ?? null, impact: 'high' },
        });
      }
    }
  }
  if (fuel.status === 'fulfilled') {
    const liters = Number(fuel.value?.estimated_liters || fuel.value?.fuel_liters || 0);
    rows.push({
      shipmentId: shipment.id,
      type: 'FUEL_ESTIMATE_LITERS',
      value: liters,
      confidence: fuel.value?.confidence ?? null,
      modelVersion: fuel.value?.fallback ? 'fallback' : '2.1.0',
      modelName: fuel.value?.model_name || 'fuel_estimation',
      source: fuel.value?.fallback ? 'heuristic' : (fuel.value?.source || 'ml_service'),
      latencyMs: fuel.value?.latency_ms ?? null,
    });
    rows.push({
      shipmentId: shipment.id,
      type: 'CO2_KG',
      value: Number(mlService.estimateCo2(distanceKm, truck.truckType)),
      modelVersion: 'derived-backend',
      modelName: 'co2_derived',
      source: 'derived_backend',
      explanation: { basis: 'distance_km * emission_rate' },
    });
  }

  if (rows.length === 0) return;

  await prisma.$transaction([
    prisma.prediction.deleteMany({
      where: {
        shipmentId: shipment.id,
        type: { in: ['ETA_HOURS', 'DELAY_RISK_PERCENT', 'FUEL_ESTIMATE_LITERS', 'CO2_KG'] },
      },
    }),
    prisma.prediction.createMany({ data: rows }),
  ]);
  logger.info('Dealer ML predictions generated', { shipmentId, truckId, predictionCount: rows.length, requestId });
}

async function generateForNewTruck(truckId, dealerId, requestId) {
  const truck = await prisma.truck.findUnique({
    where: { id: truckId },
    select: { id: true, dealerId: true, capacityKg: true, capacityM3: true },
  });
  if (!truck || truck.dealerId !== dealerId) return;

  const shipment = await prisma.shipment.findFirst({
    where: {
      status: { in: ['PENDING', 'OPTIMIZED'] },
      weightKg: { lte: truck.capacityKg },
      OR: [{ volumeM3: null }, { volumeM3: { lte: truck.capacityM3 || undefined } }],
      bookings: { none: { status: { in: ACTIVE_BOOKING_STATUSES } } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!shipment) return;

  try {
    await generateShipmentTruckPredictions(shipment.id, truckId, requestId);
  } catch (err) {
    logger.warn(`Truck-onboard ML automation skipped: ${err.message}`);
  }
}

module.exports = {
  generateShipmentTruckPredictions,
  generateForNewTruck,
};
