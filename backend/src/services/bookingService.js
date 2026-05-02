/**
 * services/bookingService.js
 * Pure business logic. No req/res. Testable in isolation.
 */

const bookingRepo = require('../repositories/bookingRepository');
const { calculateRoute } = require('./routeService');
const pricingService = require('./pricingService');
const { AppError } = require('../helpers/errors');
const { prisma } = require('../config/db');
const logger = require('../config/logger');

// ── State machine ─────────────────────────────────────────────────────────────
const TRANSITIONS = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
};

// Who can trigger each status change
const ROLE_GATES = {
  APPROVED: ['DEALER', 'CARGO_DEALER', 'ADMIN'],
  REJECTED: ['DEALER', 'CARGO_DEALER', 'ADMIN'],
  ASSIGNED: ['DEALER', 'CARGO_DEALER', 'ADMIN'],
  CANCELLED: ['WAREHOUSE', 'CARGO_DEALER', 'ADMIN'],
  PICKED_UP: ['DEALER', 'CARGO_DEALER', 'ADMIN'],
  IN_TRANSIT: ['DEALER', 'CARGO_DEALER', 'ADMIN'],
  DELIVERED: ['DEALER', 'CARGO_DEALER', 'ADMIN'],
};

/**
 * Create a booking.
 * @param {{ shipmentId, truckId, warehouseId, notes, optimScore }} params
 * @returns {Booking}
 */
async function create({ shipmentId, truckId, warehouseId, notes, optimScore }) {
  // Existence checks (outside tx for speed; tx re-checks atomically)
  const [shipment, truck] = await Promise.all([
    prisma.shipment.findUnique({ where: { id: shipmentId }, select: { warehouseId: true, pickupLocation: true, destination: true, weightKg: true } }),
    prisma.truck.findUnique({
      where: { id: truckId },
      select: { id: true, dealerId: true, truckType: true, pricePerKm: true },
    }),
  ]);

  if (!shipment) throw AppError.notFound('Shipment not found');
  if (!truck) throw AppError.notFound('Truck not found');

  if (shipment.warehouseId !== warehouseId) {
    throw AppError.forbidden('You do not own this shipment');
  }

  const { distanceKm, durationMin } = await calculateRoute(shipment.pickupLocation, shipment.destination);
  const estimatedEta = new Date(Date.now() + durationMin * 60 * 1000);
  const pricing = pricingService.calculate({
    distanceKm,
    weightKg: shipment.weightKg,
    truckType: truck.truckType,
    dealerPricePerKm: truck.pricePerKm,
  });

  const booking = await bookingRepo.createWithRetry({
    shipmentId,
    truckId,
    warehouseId,
    dealerId: truck.dealerId,
    distanceKm,
    estimatedEta,
    pricing,
    notes: notes || null,
    optimScore: optimScore || null,
  });

  logger.info(`Booking created: ${booking.id}`);
  return booking;
}

/**
 * Transition a booking to a new status.
 * @param {{ bookingId, newStatus, notes, userId, userRole }} params
 * @returns {Booking}
 */
async function transitionStatus({ bookingId, newStatus, notes, userId, userRole }) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  // Role gate
  const allowedRoles = ROLE_GATES[newStatus] || [];
  if (!allowedRoles.includes(userRole)) {
    throw AppError.forbidden(`Role ${userRole} cannot set status ${newStatus}`);
  }

  // State machine
  const allowed = TRANSITIONS[booking.status] || [];
  if (!allowed.includes(newStatus)) {
    throw AppError.badRequest(`Cannot transition from ${booking.status} → ${newStatus}`);
  }

  const data = { status: newStatus };
  if (notes) data.notes = notes;
  if (newStatus === 'PICKED_UP') data.pickedUpAt = new Date();
  if (newStatus === 'DELIVERED') data.deliveredAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({ where: { id: bookingId }, data });

    if (newStatus === 'APPROVED') {
      // Guard against concurrent approval of same truck
      const conflict = await tx.booking.findFirst({
        where: {
          truckId: booking.truckId,
          id: { not: bookingId },
          status: { in: ['APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
        select: { id: true },
      });
      if (conflict) throw AppError.conflict('Truck is already assigned to another booking');

      await tx.truck.update({
        where: { id: booking.truckId },
        data: { status: 'BOOKED', availability: false },
      });
    }

    if (['PICKED_UP', 'IN_TRANSIT'].includes(newStatus)) {
      await Promise.all([
        tx.truck.update({ where: { id: booking.truckId }, data: { status: 'IN_TRANSIT', availability: false } }),
        tx.shipment.update({ where: { id: booking.shipmentId }, data: { status: 'IN_TRANSIT' } }),
      ]);
    }

    if (newStatus === 'DELIVERED') {
      const deliveredAt = new Date();
      const pickedAt = booking.pickedUpAt ? new Date(booking.pickedUpAt) : null;
      const actualDurationHours = pickedAt ? Number(((deliveredAt.getTime() - pickedAt.getTime()) / (1000 * 60 * 60)).toFixed(2)) : null;
      const fuelPrediction = await tx.prediction.findFirst({
        where: { shipmentId: booking.shipmentId, type: 'FUEL_ESTIMATE_LITERS' },
        orderBy: { createdAt: 'desc' },
        select: { value: true },
      });
      const invoiceNo = `INV-${Date.now()}`;
      await Promise.all([
        tx.booking.update({
          where: { id: bookingId },
          data: {
            deliveredAt,
            actualDurationHours,
            actualDistanceKm: booking.distanceKm ?? null,
            actualFuelLiters: fuelPrediction?.value ?? null,
          },
        }),
        tx.truck.update({ where: { id: booking.truckId }, data: { status: 'AVAILABLE', availability: true } }),
        tx.shipment.update({ where: { id: booking.shipmentId }, data: { status: 'DELIVERED' } }),
        tx.invoice.create({
          data: {
            bookingId,
            userId: booking.warehouseId,
            invoiceNo,
            pricing: booking.pricing || {},
            status: 'PENDING',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);
    }

    if (['CANCELLED', 'REJECTED'].includes(newStatus)) {
      const [otherTruckBooking, otherShipmentBooking] = await Promise.all([
        tx.booking.findFirst({
          where: {
            truckId: booking.truckId,
            id: { not: bookingId },
            status: { in: ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
          },
          select: { id: true },
        }),
        tx.booking.findFirst({
          where: {
            shipmentId: booking.shipmentId,
            id: { not: bookingId },
            status: { in: ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
          },
          select: { status: true },
        }),
      ]);

      if (!otherTruckBooking) {
        await tx.truck.update({
          where: { id: booking.truckId },
          data: { status: 'AVAILABLE', availability: true },
        });
      }

      const nextShipmentStatus = otherShipmentBooking
        ? ['PICKED_UP', 'IN_TRANSIT'].includes(otherShipmentBooking.status) ? 'IN_TRANSIT' : 'BOOKED'
        : 'PENDING';

      await tx.shipment.update({
        where: { id: booking.shipmentId },
        data: { status: nextShipmentStatus },
      });
    }

    return b;
  }, {
    // Production-like Neon latency can exceed Prisma defaults under concurrent dashboard polling.
    // Give status transitions enough headroom instead of failing with 500.
    maxWait: 10_000,
    timeout: 20_000,
  });

  logger.info(`Booking ${bookingId}: ${booking.status} → ${newStatus} by user ${userId}`);
  return updated;
}

/**
 * List bookings for a warehouse.
 */
async function listForWarehouse(warehouseId, query) {
  return bookingRepo.findByWarehouse(warehouseId, query);
}

/**
 * List bookings for a dealer.
 */
async function listForDealer(dealerId, query) {
  return bookingRepo.findByDealer(dealerId, query);
}

/**
 * List all bookings (admin).
 */
async function listAll(query) {
  return bookingRepo.findAll(query);
}

/**
 * Get single booking, with access check.
 */
async function getOne(bookingId, user) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const isWarehouse = booking.warehouseId === user.id;
  const isDealer = booking.dealerId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isWarehouse && !isDealer && !isAdmin) throw AppError.forbidden();
  return booking;
}

module.exports = { create, transitionStatus, listForWarehouse, listForDealer, listAll, getOne };