const { prisma } = require('../config/db');
const { toClientNotification } = require('../services/notificationService');

// Get all notifications for current user
async function getMyNotifications(req, res, next) {
    try {
        const {
            unreadOnly,
            type,
            from,
            to,
            page = 1,
            limit = 20,
        } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Math.min(Number(limit) || 20, 100);
        const where = { userId: req.user.id };
        if (unreadOnly === 'true') where.isRead = false;
        if (type) where.type = type;
        if (from || to) {
            where.createdAt = {};
            if (from) {
                const fromDate = new Date(from);
                if (!Number.isNaN(fromDate.getTime())) where.createdAt.gte = fromDate;
            }
            if (to) {
                const toDate = new Date(to);
                if (!Number.isNaN(toDate.getTime())) where.createdAt.lte = toDate;
            }
            if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
        }

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
        ]);

        res.json({
            success: true,
            total,
            unreadCount,
            page: Number(page),
            limit: take,
            totalPages: Math.ceil(total / take),
            hasNextPage: skip + notifications.length < total,
            notifications: notifications.map(toClientNotification),
        });
    } catch (err) {
        next(err);
    }
}

// Mark a single notification as read
async function markRead(req, res, next) {
    try {
        const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
        if (notification.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const updated = await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true },
        });

        const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
        res.json({ success: true, notification: toClientNotification(updated), unreadCount });
    } catch (err) {
        next(err);
    }
}

// Mark all notifications as read
async function markAllRead(req, res, next) {
    try {
        const result = await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true, message: 'All notifications marked as read', updatedCount: result.count, unreadCount: 0 });
    } catch (err) {
        next(err);
    }
}

// Delete a notification
async function deleteNotification(req, res, next) {
    try {
        const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
        if (notification.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        await prisma.notification.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        next(err);
    }
}

module.exports = { getMyNotifications, markRead, markAllRead, deleteNotification };
