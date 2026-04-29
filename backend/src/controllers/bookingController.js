/**
 * controllers/bookingController.js
 * Thin layer: parse request → call service → format response.
 * No business logic. No Prisma.
 */

const bookingService = require('../services/bookingService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { asyncHandler } = require('../helpers/errors');
const { parsePagination, paginatedResponse } = require('../helpers/pagination');
const { emitShipmentStatusUpdate } = require('../helpers/realtime');
const logger = require('../config/logger');

// ── POST /api/bookings/dealer-accept ────────────────────────────────────────
// Dealer self-accepts a shipment match → creates booking + immediately approves it
const dealerAcceptShipment = asyncHandler(async (req, res) => {
    const { shipmentId, truckId, notes } = req.body;

    const { booking, shipmentStatusChange } = await bookingService.create({
        shipmentId,
        truckId,
        warehouseId: null, // resolved from shipment inside service
        dealerInitiated: true,
        notes,
        optimScore: null,
        actingDealerId: req.user.id,
    });

    const io = req.app.get('io');
    emitShipmentStatusUpdate(io, shipmentStatusChange);
    notificationService
        .bookingRequested(io, { dealerId: booking.dealerId, bookingId: booking.id, shipmentId, warehouseName: 'Dealer-initiated' })
        .catch((e) => logger.warn(`Notification failed: ${e.message}`));

    res.status(201).json({ success: true, booking });
});

// ── POST /api/bookings ───────────────────────────────────────────────────────
const createBooking = asyncHandler(async (req, res) => {
    const { shipmentId, truckId, notes, optimScore } = req.body;

    const { booking, shipmentStatusChange } = await bookingService.create({
        shipmentId,
        truckId,
        warehouseId: req.user.id,
        notes,
        optimScore,
    });

    // Side effects (non-blocking — failures don't abort the response)
    const io = req.app.get('io');
    const warehouseName = req.user.name || req.user.email;
    notificationService
        .bookingRequested(io, { dealerId: booking.dealerId, bookingId: booking.id, shipmentId, warehouseName })
        .catch((e) => logger.warn(`Notification failed: ${e.message}`));
    emitShipmentStatusUpdate(io, shipmentStatusChange);

    res.status(201).json({ success: true, booking });
});

// ── GET /api/bookings/my ─────────────────────────────────────────────────────
const getMyBookings = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await bookingService.listForWarehouse(req.user.id, { status, skip, limit });
    res.json({ success: true, ...paginatedResponse(items, total, page, limit) });
});

// ── GET /api/bookings/dealer ─────────────────────────────────────────────────
const getDealerBookings = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await bookingService.listForDealer(req.user.id, { status, skip, limit });
    res.json({ success: true, ...paginatedResponse(items, total, page, limit) });
});

// ── GET /api/bookings ─────────────────────────────────────────────────────────
const getAllBookings = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await bookingService.listAll({ status, skip, limit });
    res.json({ success: true, ...paginatedResponse(items, total, page, limit) });
});

// ── GET /api/bookings/:id ────────────────────────────────────────────────────
const getBooking = asyncHandler(async (req, res) => {
    const booking = await bookingService.getOne(req.params.id, req.user);
    res.json({ success: true, booking });
});

// ── PATCH /api/bookings/:id/status ───────────────────────────────────────────
const updateBookingStatus = asyncHandler(async (req, res) => {
    const { status, notes } = req.body;

    const { booking: updated, shipmentStatusChange } = await bookingService.transitionStatus({
        bookingId: req.params.id,
        newStatus: status,
        notes,
        userId: req.user.id,
        userRole: req.user.role,
    });

    // Real-time update
    const io = req.app.get('io');
    io.to(`booking:${updated.id}`).emit('booking:statusUpdate', { bookingId: updated.id, status });
    emitShipmentStatusUpdate(io, shipmentStatusChange);

    // Fire-and-forget side effects
    _fireStatusSideEffects(io, updated, status).catch((e) =>
        logger.warn(`Status side-effects failed for booking ${updated.id}: ${e.message}`)
    );

    res.json({ success: true, booking: updated });
});

/** Non-blocking notifications + emails keyed on status */
async function _fireStatusSideEffects(io, booking, status) {
    switch (status) {
        case 'APPROVED':
            await Promise.allSettled([
                notificationService.bookingApproved(io, {
                    warehouseId: booking.warehouseId,
                    bookingId: booking.id,
                    truckRegNo: booking.truck?.registrationNo,
                }),
                emailService.sendBookingConfirmation({
                    to: booking.warehouse?.email,
                    bookingId: booking.id,
                    shipmentId: booking.shipmentId,
                    truckRegNo: booking.truck?.registrationNo,
                    estimatedEta: booking.estimatedEta,
                }),
            ]);
            break;
        case 'REJECTED':
            await notificationService.bookingRejected(io, {
                warehouseId: booking.warehouseId,
                bookingId: booking.id,
            });
            break;
        case 'PICKED_UP':
            await notificationService.shipmentPickedUp(io, {
                warehouseId: booking.warehouseId,
                bookingId: booking.id,
                shipmentId: booking.shipmentId,
            });
            break;
        case 'DELIVERED':
            await Promise.allSettled([
                notificationService.shipmentDelivered(io, {
                    warehouseId: booking.warehouseId,
                    dealerId: booking.dealerId,
                    bookingId: booking.id,
                    shipmentId: booking.shipmentId,
                }),
                emailService.sendDeliveryConfirmation({
                    to: booking.warehouse?.email,
                    bookingId: booking.id,
                    deliveredAt: booking.deliveredAt,
                }),
            ]);
            break;
        default:
            break;
    }
}

module.exports = {
    dealerAcceptShipment,
    createBooking,
    getMyBookings,
    getDealerBookings,
    getAllBookings,
    getBooking,
    updateBookingStatus,
};
