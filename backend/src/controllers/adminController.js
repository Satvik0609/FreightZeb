const { prisma } = require('../config/db');
const logger = require('../config/logger');
const mlService = require('../services/mlService');

async function getAllUsers(req, res, next) {
    try {
        const { role, isActive, search, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};

        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive === 'true';
        if (search) where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
        ];

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, email: true, name: true, role: true,
                    phone: true, company: true, isActive: true, createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.user.count({ where }),
        ]);

        res.json({ success: true, total, page: Number(page), limit: Number(limit), users });
    } catch (err) {
        next(err);
    }
}

async function getUser(req, res, next) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, email: true, name: true, role: true,
                phone: true, company: true, isActive: true, createdAt: true,
                _count: { select: { shipments: true, trucks: true } },
            },
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
}

async function updateUserRole(req, res, next) {
    try {
        const { role } = req.body;
        if (!['ADMIN', 'WAREHOUSE', 'DEALER'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { role },
            select: { id: true, email: true, name: true, role: true },
        });

        logger.info(`Admin ${req.user.email} changed role of ${user.email} to ${role}`);
        res.json({ success: true, user });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'User not found' });
        next(err);
    }
}

async function toggleUserActive(req, res, next) {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
        }

        const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { isActive: !existing.isActive },
            select: { id: true, email: true, name: true, isActive: true },
        });

        logger.info(`Admin ${req.user.email} ${user.isActive ? 'activated' : 'deactivated'} user ${user.email}`);
        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
}

async function deleteUser(req, res, next) {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }
        await prisma.user.delete({ where: { id: req.params.id } });
        logger.info(`Admin ${req.user.email} deleted user ${req.params.id}`);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'User not found' });
        // P2003 = FK constraint: user still has trucks / shipments / bookings
        if (err.code === 'P2003') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete user: they still have associated trucks, shipments, or bookings. Deactivate the account instead, or reassign/delete their records first.',
            });
        }
        next(err);
    }
}

function monthLabel(date) {
    return new Date(date).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

async function getFinanceSummary(req, res, next) {
    try {
        const [invoices, deliveredBookings] = await Promise.all([
            prisma.invoice.findMany({
                select: { status: true, pricing: true, issuedAt: true, paidAt: true, dueDate: true },
            }),
            prisma.booking.findMany({
                where: { status: 'DELIVERED' },
                select: { deliveredAt: true, pricing: true, invoice: { select: { pricing: true } } },
            }),
        ]);

        const totalRevenue = deliveredBookings.reduce((sum, b) => {
            const pricing = b?.pricing || b?.invoice?.pricing || {};
            const value = Number(pricing.total ?? pricing.grandTotal ?? 0);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);

        const now = new Date();
        const pendingInvoices = invoices.filter((i) => i.status === 'PENDING').length;
        const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE' || (i.status === 'PENDING' && i.dueDate && i.dueDate < now)).length;
        const paidInvoices = invoices.filter((i) => i.status === 'PAID').length;

        const monthlyRevenueMap = new Map();
        deliveredBookings.forEach((b) => {
            if (!b.deliveredAt) return;
            const key = monthLabel(b.deliveredAt);
            const pricing = b?.pricing || b?.invoice?.pricing || {};
            const value = Number(pricing.total ?? pricing.grandTotal ?? 0);
            monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + (Number.isFinite(value) ? value : 0));
        });
        const monthlyRevenue = Array.from(monthlyRevenueMap.entries()).map(([month, revenue]) => ({
            month,
            revenue: Number(revenue.toFixed(2)),
        }));

        res.json({
            success: true,
            summary: {
                totalRevenue: Number(totalRevenue.toFixed(2)),
                pendingInvoices,
                overdueInvoices,
                paidInvoices,
                deliveredBookings: deliveredBookings.length,
            },
            monthlyRevenue,
        });
    } catch (err) {
        next(err);
    }
}

async function getAuditLogs(req, res, next) {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

        const [recentUsers, recentBookings, recentShipments, recentInvoices] = await Promise.all([
            prisma.user.findMany({
                take: limit,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
            }),
            prisma.booking.findMany({
                take: limit,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, status: true, updatedAt: true, warehouse: { select: { name: true } }, dealer: { select: { name: true } } },
            }),
            prisma.shipment.findMany({
                take: limit,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, status: true, updatedAt: true, warehouse: { select: { name: true } } },
            }),
            prisma.invoice.findMany({
                take: limit,
                orderBy: { issuedAt: 'desc' },
                select: { id: true, invoiceNo: true, status: true, issuedAt: true, paidAt: true },
            }),
        ]);

        const logs = [
            ...recentUsers.map((u) => ({
                id: `user-${u.id}-${u.updatedAt.toISOString()}`,
                timestamp: u.updatedAt,
                category: 'USER',
                action: u.createdAt.getTime() === u.updatedAt.getTime() ? 'CREATED' : 'UPDATED',
                actor: 'ADMIN_OR_SYSTEM',
                subject: `${u.name} (${u.email})`,
                details: `Role: ${u.role} · Active: ${u.isActive}`,
            })),
            ...recentBookings.map((b) => ({
                id: `booking-${b.id}-${b.updatedAt.toISOString()}`,
                timestamp: b.updatedAt,
                category: 'BOOKING',
                action: 'STATUS_CHANGED',
                actor: 'DEALER_OR_WAREHOUSE_OR_ADMIN',
                subject: `Booking ${b.id.slice(0, 8)}`,
                details: `Status: ${b.status} · Warehouse: ${b.warehouse?.name || '—'} · Dealer: ${b.dealer?.name || '—'}`,
            })),
            ...recentShipments.map((s) => ({
                id: `shipment-${s.id}-${s.updatedAt.toISOString()}`,
                timestamp: s.updatedAt,
                category: 'SHIPMENT',
                action: 'STATUS_CHANGED',
                actor: 'WAREHOUSE_OR_ADMIN',
                subject: `Shipment ${s.id.slice(0, 8)}`,
                details: `Status: ${s.status} · Warehouse: ${s.warehouse?.name || '—'}`,
            })),
            ...recentInvoices.map((i) => ({
                id: `invoice-${i.id}-${(i.paidAt || i.issuedAt).toISOString()}`,
                timestamp: i.paidAt || i.issuedAt,
                category: 'INVOICE',
                action: i.paidAt ? 'PAID' : 'ISSUED',
                actor: 'ADMIN_OR_SYSTEM',
                subject: i.invoiceNo || `Invoice ${i.id.slice(0, 8)}`,
                details: `Status: ${i.status}`,
            })),
        ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);

        res.json({ success: true, logs });
    } catch (err) {
        next(err);
    }
}

async function getSystemHealth(req, res, next) {
    try {
        const startedAt = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatencyMs = Date.now() - startedAt;

        const memory = process.memoryUsage();
        const mlCircuit = mlService.getCircuitStatus();
        const mlMetrics = mlService.getMetricsSummary();

        res.json({
            success: true,
            health: {
                service: 'freightzeb-api',
                uptimeSec: Math.round(process.uptime()),
                nodeVersion: process.version,
                db: {
                    status: 'UP',
                    latencyMs: dbLatencyMs,
                },
                memory: {
                    rssMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
                    heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
                    heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(1)),
                },
                ml: {
                    circuit: mlCircuit,
                    metrics: mlMetrics,
                },
                checkedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAllUsers,
    getUser,
    updateUserRole,
    toggleUserActive,
    deleteUser,
    getFinanceSummary,
    getAuditLogs,
    getSystemHealth,
};
