const { prisma } = require('../config/db');

// ── Warehouse analytics ──────────────────────────────────────────────────────
async function getWarehouseAnalytics(req, res, next) {
    try {
        const warehouseId = req.user.id;

        const [
            totalShipments,
            byStatus,
            bookings,
            predictions,
        ] = await Promise.all([
            prisma.shipment.count({ where: { warehouseId } }),
            prisma.shipment.groupBy({ by: ['status'], where: { warehouseId }, _count: true }),
            prisma.booking.findMany({
                where: { warehouseId, status: 'DELIVERED' },
                select: { distanceKm: true, createdAt: true, deliveredAt: true },
            }),
            prisma.prediction.findMany({
                where: { shipment: { warehouseId } },
                select: { type: true, value: true },
            }),
        ]);

        const totalDistanceKm = bookings.reduce((s, b) => s + (b.distanceKm || 0), 0);
        const deliveredCount = bookings.length;

        const etaPredictions = predictions.filter((p) => p.type === 'ETA_HOURS');
        const avgEta = etaPredictions.length
            ? etaPredictions.reduce((s, p) => s + p.value, 0) / etaPredictions.length
            : null;

        const co2Predictions = predictions.filter((p) => p.type === 'CO2_KG');
        const totalCo2Saved = co2Predictions.reduce((s, p) => s + p.value, 0);

        res.json({
            success: true,
            analytics: {
                totalShipments,
                byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
                deliveredCount,
                totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
                avgEtaHours: avgEta ? parseFloat(avgEta.toFixed(2)) : null,
                totalCo2SavedKg: parseFloat(totalCo2Saved.toFixed(2)),
            },
        });
    } catch (err) {
        next(err);
    }
}

// ── Dealer analytics ─────────────────────────────────────────────────────────
async function getDealerAnalytics(req, res, next) {
    try {
        const dealerId = req.user.id;

        const [
            totalTrucks,
            trucksByStatus,
            bookingsByStatus,
            deliveredBookings,
        ] = await Promise.all([
            prisma.truck.count({ where: { dealerId } }),
            prisma.truck.groupBy({ by: ['status'], where: { dealerId }, _count: true }),
            prisma.booking.groupBy({ by: ['status'], where: { dealerId }, _count: true }),
            prisma.booking.findMany({
                where: { dealerId, status: 'DELIVERED' },
                select: { distanceKm: true, optimScore: true },
            }),
        ]);

        const totalKm = deliveredBookings.reduce((s, b) => s + (b.distanceKm || 0), 0);
        const avgScore = deliveredBookings.length
            ? deliveredBookings.reduce((s, b) => s + (b.optimScore || 0), 0) / deliveredBookings.length
            : null;

        // Fleet utilization = trucks not AVAILABLE / total
        const availableCount = trucksByStatus.find((t) => t.status === 'AVAILABLE')?._count || 0;
        const utilizationPct = totalTrucks > 0 ? parseFloat((((totalTrucks - availableCount) / totalTrucks) * 100).toFixed(1)) : 0;

        res.json({
            success: true,
            analytics: {
                totalTrucks,
                trucksByStatus: Object.fromEntries(trucksByStatus.map((t) => [t.status, t._count._all])),
                bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count._all])),
                totalDeliveredKm: parseFloat(totalKm.toFixed(2)),
                avgOptimizationScore: avgScore ? parseFloat(avgScore.toFixed(3)) : null,
                fleetUtilizationPct: utilizationPct,
            },
        });
    } catch (err) {
        next(err);
    }
}

// ── Admin analytics ──────────────────────────────────────────────────────────
async function getAdminAnalytics(req, res, next) {
    try {
        const [
            totalUsers,
            usersByRole,
            totalShipments,
            shipmentsByStatus,
            totalTrucks,
            trucksByStatus,
            totalBookings,
            bookingsByStatus,
            recentBookings,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.groupBy({ by: ['role'], _count: true }),
            prisma.shipment.count(),
            prisma.shipment.groupBy({ by: ['status'], _count: true }),
            prisma.truck.count(),
            prisma.truck.groupBy({ by: ['status'], _count: true }),
            prisma.booking.count(),
            prisma.booking.groupBy({ by: ['status'], _count: true }),
            prisma.booking.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    warehouse: { select: { name: true, company: true } },
                    dealer: { select: { name: true, company: true } },
                    truck: { select: { registrationNo: true, truckType: true } },
                },
            }),
        ]);

        const deliveredBookings = await prisma.booking.findMany({
            where: { status: 'DELIVERED' },
            select: { distanceKm: true },
        });
        const totalKm = deliveredBookings.reduce((s, b) => s + (b.distanceKm || 0), 0);

        res.json({
            success: true,
            analytics: {
                users: { total: totalUsers, byRole: Object.fromEntries(usersByRole.map((u) => [u.role, u._count._all])) },
                shipments: { total: totalShipments, byStatus: Object.fromEntries(shipmentsByStatus.map((s) => [s.status, s._count._all])) },
                trucks: { total: totalTrucks, byStatus: Object.fromEntries(trucksByStatus.map((t) => [t.status, t._count._all])) },
                bookings: { total: totalBookings, byStatus: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count._all])) },
                totalDeliveredKm: parseFloat(totalKm.toFixed(2)),
            },
            recentBookings,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getWarehouseAnalytics, getDealerAnalytics, getAdminAnalytics };
