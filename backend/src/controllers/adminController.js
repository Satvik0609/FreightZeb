const { prisma } = require('../config/db');
const logger = require('../config/logger');

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
        if (!['ADMIN', 'WAREHOUSE', 'DEALER', 'CARGO_DEALER'].includes(role)) {
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

module.exports = { getAllUsers, getUser, updateUserRole, toggleUserActive, deleteUser };
