/**
 * NOTIFICATION SERVICE
 * Handles in-app notifications stored in DB + real-time socket push.
 * Email notifications are delegated to emailService.
 */

const { prisma } = require('../config/db');
const logger = require('../config/logger');

const TYPE_CONFIG = {
    BOOKING_REQUESTED: { priority: 'info' },
    BOOKING_APPROVED: { priority: 'info' },
    BOOKING_REJECTED: { priority: 'warning' },
    BOOKING_ASSIGNED: { priority: 'info' },
    SHIPMENT_PICKED_UP: { priority: 'info' },
    SHIPMENT_IN_TRANSIT: { priority: 'info' },
    SHIPMENT_CANCELLED: { priority: 'warning' },
    SHIPMENT_DELIVERED: { priority: 'info' },
    TRIP_COMPLETED: { priority: 'info' },
    INVOICE_CREATED: { priority: 'info' },
    DELAY_ALERT: { priority: 'critical' },
};

function _buildActionUrl(meta = {}) {
    if (meta.invoiceId) return `/invoices/${meta.invoiceId}`;
    if (meta.bookingId) return `/bookings/${meta.bookingId}`;
    if (meta.shipmentId) return `/shipments/${meta.shipmentId}`;
    return '/notifications';
}

function toClientNotification(notification = {}) {
    const typeCfg = TYPE_CONFIG[notification.type] || { priority: 'info' };
    const meta = notification.meta || {};
    return {
        ...notification,
        priority: meta.priority || typeCfg.priority,
        actionUrl: meta.actionUrl || _buildActionUrl(meta),
        read: notification.isRead,
    };
}

/**
 * Create a notification record and push it via socket.io.
 * @param {object} io         - socket.io server instance
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.type  - e.g. 'BOOKING_REQUESTED', 'BOOKING_APPROVED', etc.
 * @param {string} params.title
 * @param {string} params.message
 * @param {object} [params.meta] - extra data (bookingId, shipmentId, etc.)
 */
async function send(io, { userId, type, title, message, meta = {} }) {
    try {
        const typeCfg = TYPE_CONFIG[type] || { priority: 'info' };
        const enrichedMeta = {
            ...meta,
            priority: meta.priority || typeCfg.priority,
            actionUrl: meta.actionUrl || _buildActionUrl(meta),
        };

        const notification = await prisma.notification.create({
            data: { userId, type, title, message, meta: enrichedMeta },
        });
        const clientPayload = toClientNotification(notification);

        // Push to user's personal socket room
        if (io) {
            io.to(`user:${userId}`).emit('notification:new', clientPayload);
        }

        return clientPayload;
    } catch (err) {
        logger.error(`Notification failed for user ${userId}: ${err.message}`);
    }
}

/**
 * Convenience wrappers for common events
 */
async function bookingRequested(io, { dealerId, bookingId, shipmentId, warehouseName }) {
    return send(io, {
        userId: dealerId,
        type: 'BOOKING_REQUESTED',
        title: 'New Booking Request',
        message: `${warehouseName} has requested a booking for shipment.`,
        meta: { bookingId, shipmentId },
    });
}

async function bookingApproved(io, { warehouseId, bookingId, truckRegNo }) {
    return send(io, {
        userId: warehouseId,
        type: 'BOOKING_APPROVED',
        title: 'Booking Approved',
        message: `Your booking has been approved. Truck: ${truckRegNo}`,
        meta: { bookingId },
    });
}

async function bookingRejected(io, { warehouseId, bookingId }) {
    return send(io, {
        userId: warehouseId,
        type: 'BOOKING_REJECTED',
        title: 'Booking Rejected',
        message: 'Your booking request was rejected by the dealer.',
        meta: { bookingId },
    });
}

async function bookingAssigned(io, { warehouseId, bookingId, shipmentId }) {
    return send(io, {
        userId: warehouseId,
        type: 'BOOKING_ASSIGNED',
        title: 'Booking Assigned',
        message: 'Dealer has assigned a truck to your shipment.',
        meta: { bookingId, shipmentId },
    });
}

async function shipmentPickedUp(io, { warehouseId, bookingId, shipmentId }) {
    return send(io, {
        userId: warehouseId,
        type: 'SHIPMENT_PICKED_UP',
        title: 'Shipment Picked Up',
        message: 'Your shipment has been picked up and is on the way.',
        meta: { bookingId, shipmentId },
    });
}

async function shipmentInTransit(io, { warehouseId, bookingId, shipmentId }) {
    return send(io, {
        userId: warehouseId,
        type: 'SHIPMENT_IN_TRANSIT',
        title: 'Shipment In Transit',
        message: 'Shipment is in transit and moving toward destination.',
        meta: { bookingId, shipmentId },
    });
}

async function shipmentCancelled(io, { dealerId, warehouseId, bookingId, shipmentId }) {
    return Promise.allSettled([
        send(io, {
            userId: warehouseId,
            type: 'SHIPMENT_CANCELLED',
            title: 'Shipment Cancelled',
            message: 'This shipment booking was cancelled.',
            meta: { bookingId, shipmentId },
        }),
        send(io, {
            userId: dealerId,
            type: 'SHIPMENT_CANCELLED',
            title: 'Shipment Cancelled',
            message: 'A shipment booking on your fleet was cancelled.',
            meta: { bookingId, shipmentId },
        }),
    ]);
}

async function shipmentDelivered(io, { warehouseId, dealerId, bookingId, shipmentId }) {
    await Promise.all([
        send(io, {
            userId: warehouseId,
            type: 'SHIPMENT_DELIVERED',
            title: 'Shipment Delivered',
            message: 'Your shipment has been successfully delivered.',
            meta: { bookingId, shipmentId },
        }),
        send(io, {
            userId: dealerId,
            type: 'TRIP_COMPLETED',
            title: 'Trip Completed',
            message: 'A delivery trip has been completed successfully.',
            meta: { bookingId, shipmentId },
        }),
    ]);
}

async function invoiceCreated(io, { warehouseId, bookingId, invoiceId }) {
    return send(io, {
        userId: warehouseId,
        type: 'INVOICE_CREATED',
        title: 'Invoice Generated',
        message: 'Invoice has been generated for your delivered shipment.',
        meta: { bookingId, invoiceId },
    });
}

module.exports = {
    send,
    toClientNotification,
    bookingRequested,
    bookingApproved,
    bookingRejected,
    bookingAssigned,
    shipmentPickedUp,
    shipmentInTransit,
    shipmentCancelled,
    shipmentDelivered,
    invoiceCreated,
};
