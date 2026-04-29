const { prisma } = require('../config/db');

function monthKey(date) {
    const d = new Date(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function monthLabel(ym) {
    const [year, month] = ym.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function buildMonthRange(monthsBack = 12) {
    const now = new Date();
    const months = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return months;
}

function coerceAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function bookingRevenue(booking) {
    const pricing = booking?.pricing || {};
    const invoicePricing = booking?.invoice?.pricing || {};
    return (
        coerceAmount(pricing.total) ||
        coerceAmount(pricing.grandTotal) ||
        coerceAmount(invoicePricing.total) ||
        coerceAmount(invoicePricing.grandTotal) ||
        0
    );
}

function seriesFromRecords(records, months, opts = {}) {
    const { dateKey = 'createdAt', valueGetter = () => 1, valueKey = 'count' } = opts;
    const buckets = Object.fromEntries(months.map((m) => [m, 0]));

    records.forEach((r) => {
        const dt = r?.[dateKey];
        if (!dt) return;
        const key = monthKey(dt);
        if (!(key in buckets)) return;
        buckets[key] += valueGetter(r);
    });

    return months.map((m) => ({
        month: monthLabel(m),
        [valueKey]: Number(buckets[m].toFixed(2)),
    }));
}

// ── Warehouse analytics ──────────────────────────────────────────────────────
async function getWarehouseAnalytics(req, res, next) {
    try {
        const warehouseId = req.user.id;
        const months = buildMonthRange(12);

        const [
            totalShipments,
            byStatus,
            bookings,
            predictions,
            shipmentRows,
            deliveredRevenueRows,
        ] = await Promise.all([
            prisma.shipment.count({ where: { warehouseId } }),
            prisma.shipment.groupBy({ by: ['status'], where: { warehouseId }, _count: true }),
            prisma.booking.findMany({
                where: { warehouseId, status: 'DELIVERED' },
                select: { distanceKm: true, createdAt: true, deliveredAt: true, pricing: true, invoice: { select: { pricing: true } } },
            }),
            prisma.prediction.findMany({
                where: { shipment: { warehouseId } },
                select: { type: true, value: true },
            }),
            prisma.shipment.findMany({
                where: { warehouseId },
                select: { createdAt: true },
            }),
            prisma.booking.findMany({
                where: { warehouseId, status: 'DELIVERED' },
                select: { deliveredAt: true, pricing: true, invoice: { select: { pricing: true } } },
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

        const shipmentTrend = seriesFromRecords(shipmentRows, months, {
            dateKey: 'createdAt',
            valueGetter: () => 1,
            valueKey: 'count',
        });

        const monthlySpend = seriesFromRecords(deliveredRevenueRows, months, {
            dateKey: 'deliveredAt',
            valueGetter: bookingRevenue,
            valueKey: 'spend',
        });

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
            shipmentTrend,
            monthlySpend,
        });
    } catch (err) {
        next(err);
    }
}

// ── Dealer analytics ─────────────────────────────────────────────────────────
async function getDealerAnalytics(req, res, next) {
    try {
        const dealerId = req.user.id;
        const months = buildMonthRange(12);

        const [
            totalTrucks,
            trucksByStatus,
            bookingsByStatus,
            deliveredBookings,
            deliveredRevenueRows,
        ] = await Promise.all([
            prisma.truck.count({ where: { dealerId } }),
            prisma.truck.groupBy({ by: ['status'], where: { dealerId }, _count: true }),
            prisma.booking.groupBy({ by: ['status'], where: { dealerId }, _count: true }),
            prisma.booking.findMany({
                where: { dealerId, status: 'DELIVERED' },
                select: { distanceKm: true, optimScore: true, deliveredAt: true, pricing: true, invoice: { select: { pricing: true } } },
            }),
            prisma.booking.findMany({
                where: { dealerId, status: 'DELIVERED' },
                select: { deliveredAt: true, pricing: true, invoice: { select: { pricing: true } } },
            }),
        ]);

        const totalKm = deliveredBookings.reduce((s, b) => s + (b.distanceKm || 0), 0);
        const avgScore = deliveredBookings.length
            ? deliveredBookings.reduce((s, b) => s + (b.optimScore || 0), 0) / deliveredBookings.length
            : null;

        // Fleet utilization = trucks not AVAILABLE / total
        const availableCount = trucksByStatus.find((t) => t.status === 'AVAILABLE')?._count?._all || 0;
        const utilizationPct = totalTrucks > 0 ? parseFloat((((totalTrucks - availableCount) / totalTrucks) * 100).toFixed(1)) : 0;

        const deliveriesByMonth = seriesFromRecords(deliveredBookings, months, {
            dateKey: 'deliveredAt',
            valueGetter: () => 1,
            valueKey: 'count',
        });
        const revenueByMonth = seriesFromRecords(deliveredRevenueRows, months, {
            dateKey: 'deliveredAt',
            valueGetter: bookingRevenue,
            valueKey: 'revenue',
        });

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
            revenueByMonth,
            deliveriesByMonth,
        });
    } catch (err) {
        next(err);
    }
}

// ── Admin analytics ──────────────────────────────────────────────────────────
async function getAdminAnalytics(req, res, next) {
    try {
        const months = buildMonthRange(12);
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
            shipmentRows,
            deliveredRevenueRows,
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
            prisma.shipment.findMany({
                select: { createdAt: true },
            }),
            prisma.booking.findMany({
                where: { status: 'DELIVERED' },
                select: { deliveredAt: true, pricing: true, invoice: { select: { pricing: true } } },
            }),
        ]);

        const deliveredBookings = await prisma.booking.findMany({
            where: { status: 'DELIVERED' },
            select: { distanceKm: true },
        });
        const totalKm = deliveredBookings.reduce((s, b) => s + (b.distanceKm || 0), 0);

        const shipmentTrend = seriesFromRecords(shipmentRows, months, {
            dateKey: 'createdAt',
            valueGetter: () => 1,
            valueKey: 'count',
        });
        const revenueByMonth = seriesFromRecords(deliveredRevenueRows, months, {
            dateKey: 'deliveredAt',
            valueGetter: bookingRevenue,
            valueKey: 'revenue',
        });

        const fleetUtilization = trucksByStatus.map((t) => ({
            type: t.status,
            count: t._count._all,
        }));

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
            shipmentTrend,
            revenueByMonth,
            fleetUtilization,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getWarehouseAnalytics, getDealerAnalytics, getAdminAnalytics };
