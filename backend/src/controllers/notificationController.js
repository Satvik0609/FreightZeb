const { prisma } = require('../config/db');

// Get all notifications for current user
async function getMyNotifications(req, res, next) {
    try {
        const { unreadOnly, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { userId: req.user.id };
        if (unreadOnly === 'true') where.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
        ]);

        res.json({ success: true, total, unreadCount, page: Number(page), limit: Number(limit), notifications });
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

        res.json({ success: true, notification: updated });
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
        res.json({ success: true, message: 'All notifications marked as read', updatedCount: result.count });
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
