const { prisma } = require('../config/db');

// Get full tracking history for a booking
async function getTrackingHistory(req, res, next) {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: req.params.bookingId },
            include: { trackingLogs: { orderBy: { timestamp: 'asc' } } },
        });

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const isWarehouse = booking.warehouseId === req.user.id;
        const isDealer = booking.dealerId === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isWarehouse && !isDealer && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        res.json({ success: true, bookingId: booking.id, status: booking.status, trackingLogs: booking.trackingLogs });
    } catch (err) {
        next(err);
    }
}

// Get latest location for a booking
async function getLatestLocation(req, res, next) {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: req.params.bookingId },
            select: { id: true, warehouseId: true, dealerId: true },
        });

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const isWarehouse = booking.warehouseId === req.user.id;
        const isDealer = booking.dealerId === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isWarehouse && !isDealer && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const log = await prisma.trackingLog.findFirst({
            where: { bookingId: req.params.bookingId },
            orderBy: { timestamp: 'desc' },
        });

        if (!log) return res.status(404).json({ success: false, message: 'No tracking data yet' });
        res.json({ success: true, location: log });
    } catch (err) {
        next(err);
    }
}

// Dealer/driver: push a location update
async function pushLocation(req, res, next) {
    try {
        const { bookingId, latitude, longitude, status } = req.body;

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { truck: true },
        });

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        if (!['PICKED_UP', 'IN_TRANSIT'].includes(booking.status)) {
            return res.status(400).json({ success: false, message: 'Booking is not active' });
        }

        const log = await prisma.$transaction(async (tx) => {
            const l = await tx.trackingLog.create({
                data: { bookingId, truckId: booking.truckId, latitude, longitude, status },
            });
            // Keep truck's currentLocation in sync
            await tx.truck.update({
                where: { id: booking.truckId },
                data: { currentLocation: { lat: latitude, lng: longitude, lastUpdated: new Date() } },
            });
            return l;
        });

        // Broadcast to all subscribers of this booking
        const io = req.app.get('io');
        io.to(`booking:${bookingId}`).emit('tracking:update', {
            bookingId,
            truckId: booking.truckId,
            latitude,
            longitude,
            status,
            timestamp: log.timestamp,
        });

        res.json({ success: true, log });
    } catch (err) {
        next(err);
    }
}

module.exports = { getTrackingHistory, getLatestLocation, pushLocation };
