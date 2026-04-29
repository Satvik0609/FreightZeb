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
const logger = require('../config/logger');

// ── POST /api/bookings ───────────────────────────────────────────────────────
const createBooking = asyncHandler(async (req, res) => {
    const { shipmentId, truckId, notes, optimScore } = req.body;

    const booking = await bookingService.create({
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

    io.to(`user:${booking.dealerId}`).emit('booking:requested', {
        bookingId: booking.id,
        shipmentId,
        warehouseId: booking.warehouseId,
        dealerId: booking.dealerId,
        status: booking.status,
    });

    res.status(201).json({ success: true, booking });
});

// ── GET /api/bookings/my ─────────────────────────────────────────────────────
const getMyBookings = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await bookingService.listForWarehouse(req.user.id, { status, skip, limit });
    const payload = paginatedResponse(items, total, page, limit);
    res.json({ success: true, ...payload, bookings: items });
});

// ── GET /api/bookings/dealer ─────────────────────────────────────────────────
const getDealerBookings = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await bookingService.listForDealer(req.user.id, { status, skip, limit });
    const payload = paginatedResponse(items, total, page, limit);
    res.json({ success: true, ...payload, bookings: items });
});

// ── GET /api/bookings ─────────────────────────────────────────────────────────
const getAllBookings = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await bookingService.listAll({ status, skip, limit });
    const payload = paginatedResponse(items, total, page, limit);
    res.json({ success: true, ...payload, bookings: items });
});

// ── GET /api/bookings/:id ────────────────────────────────────────────────────
const getBooking = asyncHandler(async (req, res) => {
    const booking = await bookingService.getOne(req.params.id, req.user);
    res.json({ success: true, booking });
});

// ── PATCH /api/bookings/:id/status ───────────────────────────────────────────
const updateBookingStatus = asyncHandler(async (req, res) => {
    const { status, notes } = req.body;

    const updated = await bookingService.transitionStatus({
        bookingId: req.params.id,
        newStatus: status,
        notes,
        userId: req.user.id,
        userRole: req.user.role,
    });

    // Real-time update
    const io = req.app.get('io');
    const bookingEvent = {
        bookingId: updated.id,
        shipmentId: updated.shipmentId,
        truckId: updated.truckId,
        warehouseId: updated.warehouseId,
        dealerId: updated.dealerId,
        status,
    };
    io.to(`booking:${updated.id}`).emit('booking:statusUpdate', bookingEvent);
    io.to(`user:${updated.warehouseId}`).emit('booking:statusUpdate', bookingEvent);
    io.to(`user:${updated.dealerId}`).emit('booking:statusUpdate', bookingEvent);

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
        case 'ASSIGNED':
            await notificationService.bookingAssigned(io, {
                warehouseId: booking.warehouseId,
                bookingId: booking.id,
                shipmentId: booking.shipmentId,
            });
            break;
        case 'IN_TRANSIT':
            await notificationService.shipmentInTransit(io, {
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
                notificationService.invoiceCreated(io, {
                    warehouseId: booking.warehouseId,
                    bookingId: booking.id,
                }),
            ]);
            break;
        case 'CANCELLED':
            await notificationService.shipmentCancelled(io, {
                dealerId: booking.dealerId,
                warehouseId: booking.warehouseId,
                bookingId: booking.id,
                shipmentId: booking.shipmentId,
            });
            break;
        default:
            break;
    }
}

module.exports = {
    createBooking,
    getMyBookings,
    getDealerBookings,
    getAllBookings,
    getBooking,
    updateBookingStatus,
};
