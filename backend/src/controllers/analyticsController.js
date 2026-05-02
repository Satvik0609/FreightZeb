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

const OPERATING_COST_PER_KM = {
    SMALL_VAN: 8,
    CONTAINER_20FT: 19,
    CONTAINER_32FT: 25,
    FLATBED_TRAILER: 28,
    REEFER: 35,
};

function bookingDistanceKm(booking) {
    const n = Number(booking?.distanceKm);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function bookingOperatingCost(booking) {
    const distanceKm = bookingDistanceKm(booking);
    const truckType = booking?.truck?.truckType;
    const rate = OPERATING_COST_PER_KM[truckType] || 22;
    return Number((distanceKm * rate).toFixed(2));
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
            trucksByType,
            truckRows,
            dealerPredictions,
            dealerBookings,
        ] = await Promise.all([
            prisma.truck.count({ where: { dealerId } }),
            prisma.truck.groupBy({ by: ['status'], where: { dealerId }, _count: true }),
            prisma.truck.groupBy({ by: ['truckType'], where: { dealerId }, _count: true }),
            prisma.truck.findMany({
                where: { dealerId },
                select: { createdAt: true, capacityKg: true, capacityM3: true, pricePerKm: true },
            }),
            prisma.prediction.findMany({
                where: {
                    shipment: {
                        bookings: { some: { dealerId } },
                    },
                    type: { in: ['ETA_HOURS', 'DELAY_RISK_PERCENT', 'FUEL_ESTIMATE_LITERS'] },
                },
                orderBy: { createdAt: 'desc' },
                select: { shipmentId: true, type: true, value: true, source: true, createdAt: true },
            }),
            prisma.booking.findMany({
                where: { dealerId, status: { in: ['APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
                select: { id: true, shipmentId: true },
            }),
        ]);

        const byStatusMap = Object.fromEntries(trucksByStatus.map((t) => [t.status, t._count._all]));
        const byTypeMap = Object.fromEntries(trucksByType.map((t) => [t.truckType, t._count._all]));

        // Fleet utilization = trucks not AVAILABLE / total
        const availableCount = byStatusMap.AVAILABLE || 0;
        const utilizationPct = totalTrucks > 0 ? parseFloat((((totalTrucks - availableCount) / totalTrucks) * 100).toFixed(1)) : 0;

        const trucksAddedByMonth = seriesFromRecords(truckRows, months, {
            dateKey: 'createdAt',
            valueGetter: () => 1,
            valueKey: 'count',
        });

        const totalCapacityKg = truckRows.reduce((sum, t) => sum + (t.capacityKg || 0), 0);
        const totalCapacityM3 = truckRows.reduce((sum, t) => sum + (t.capacityM3 || 0), 0);
        const avgPricePerKmRaw = truckRows
            .filter((t) => t.pricePerKm !== null && t.pricePerKm !== undefined)
            .map((t) => Number(t.pricePerKm));
        const avgPricePerKm = avgPricePerKmRaw.length
            ? parseFloat((avgPricePerKmRaw.reduce((s, n) => s + n, 0) / avgPricePerKmRaw.length).toFixed(2))
            : null;

        const activeShipmentIds = new Set(dealerBookings.map((b) => b.shipmentId));
        const delayPredictions = dealerPredictions.filter((p) => p.type === 'DELAY_RISK_PERCENT');
        const activeDelayPredictions = delayPredictions.filter((p) => activeShipmentIds.has(p.shipmentId));
        const etaPredictions = dealerPredictions.filter((p) => p.type === 'ETA_HOURS');
        const fallbackShare = dealerPredictions.length
            ? Number((dealerPredictions.filter((p) => p.source === 'heuristic').length / dealerPredictions.length).toFixed(3))
            : 0;
        const freshnessMinutes = dealerPredictions.length
            ? Number(((Date.now() - new Date(dealerPredictions[0].createdAt).getTime()) / 60000).toFixed(1))
            : null;

        res.json({
            success: true,
            analytics: {
                totalTrucks,
                trucksByStatus: byStatusMap,
                trucksByType: byTypeMap,
                fleetUtilizationPct: utilizationPct,
                totalCapacityKg: parseFloat(totalCapacityKg.toFixed(2)),
                totalCapacityM3: parseFloat(totalCapacityM3.toFixed(2)),
                avgPricePerKm,
                avgPredictedEtaHours: etaPredictions.length ? Number((etaPredictions.reduce((s, p) => s + p.value, 0) / etaPredictions.length).toFixed(2)) : null,
                avgDelayRiskPercent: delayPredictions.length ? Number((delayPredictions.reduce((s, p) => s + p.value, 0) / delayPredictions.length).toFixed(2)) : null,
                highRiskActiveTrips: activeDelayPredictions.filter((p) => p.value >= 70).length,
                predictionFreshnessMinutes: freshnessMinutes,
                fallbackShare,
            },
            trucksAddedByMonth,
        });
    } catch (err) {
        next(err);
    }
}

// ── Dealer earnings ───────────────────────────────────────────────────────────
async function getDealerEarnings(req, res, next) {
    try {
        const dealerId = req.user.id;
        const months = buildMonthRange(12);

        const deliveredBookings = await prisma.booking.findMany({
            where: { dealerId, status: 'DELIVERED' },
            select: {
                id: true,
                shipmentId: true,
                truckId: true,
                distanceKm: true,
                pricing: true,
                deliveredAt: true,
                createdAt: true,
                shipment: {
                    select: {
                        pickupLocation: true,
                        destination: true,
                        weightKg: true,
                    },
                },
                truck: {
                    select: {
                        registrationNo: true,
                        truckType: true,
                    },
                },
                warehouse: {
                    select: {
                        name: true,
                        company: true,
                    },
                },
                invoice: {
                    select: {
                        status: true,
                        invoiceNo: true,
                    },
                },
            },
            orderBy: { deliveredAt: 'desc' },
        });

        const rows = deliveredBookings.map((booking) => {
            const revenue = bookingRevenue(booking);
            const operatingCost = bookingOperatingCost(booking);
            const profit = Number((revenue - operatingCost).toFixed(2));
            const marginPct = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;
            return {
                id: booking.id,
                shipmentId: booking.shipmentId,
                truckId: booking.truckId,
                truckRegistrationNo: booking.truck?.registrationNo || null,
                truckType: booking.truck?.truckType || null,
                warehouseName: booking.warehouse?.name || null,
                warehouseCompany: booking.warehouse?.company || null,
                deliveredAt: booking.deliveredAt || null,
                distanceKm: bookingDistanceKm(booking),
                revenue,
                operatingCost,
                profit,
                marginPct,
                invoiceStatus: booking.invoice?.status || null,
                invoiceNo: booking.invoice?.invoiceNo || null,
                shipment: booking.shipment || null,
            };
        });

        const totalRevenue = Number(rows.reduce((sum, row) => sum + row.revenue, 0).toFixed(2));
        const totalOperatingCost = Number(rows.reduce((sum, row) => sum + row.operatingCost, 0).toFixed(2));
        const totalProfit = Number((totalRevenue - totalOperatingCost).toFixed(2));
        const avgProfitMarginPct = totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0;
        const totalDistanceKm = Number(rows.reduce((sum, row) => sum + row.distanceKm, 0).toFixed(2));

        const monthlyRevenue = seriesFromRecords(rows, months, {
            dateKey: 'deliveredAt',
            valueGetter: (row) => row.revenue,
            valueKey: 'revenue',
        });
        const monthlyCosts = seriesFromRecords(rows, months, {
            dateKey: 'deliveredAt',
            valueGetter: (row) => row.operatingCost,
            valueKey: 'operatingCost',
        });
        const monthlyEarnings = monthlyRevenue.map((month, i) => {
            const operatingCost = Number(monthlyCosts[i].operatingCost.toFixed(2));
            return {
                ...month,
                operatingCost,
                profit: Number((month.revenue - operatingCost).toFixed(2)),
            };
        });

        res.json({
            success: true,
            metrics: {
                deliveredTrips: rows.length,
                totalDistanceKm,
                totalRevenue,
                totalOperatingCost,
                totalProfit,
                avgProfitMarginPct,
            },
            monthlyEarnings,
            bookings: rows.slice(0, 50),
            costModel: {
                source: 'heuristic_per_km_by_truck_type',
                ratesInrPerKm: OPERATING_COST_PER_KM,
            },
        });
    } catch (err) {
        next(err);
    }
}

// ── Admin dealer-earnings intelligence ────────────────────────────────────────
async function getAdminEarnings(req, res, next) {
    try {
        const months = buildMonthRange(12);
        const deliveredBookings = await prisma.booking.findMany({
            where: { status: 'DELIVERED' },
            select: {
                id: true,
                dealerId: true,
                distanceKm: true,
                pricing: true,
                deliveredAt: true,
                dealer: { select: { id: true, name: true, email: true, company: true } },
                truck: { select: { truckType: true } },
                invoice: { select: { status: true } },
            },
        });

        const rows = deliveredBookings.map((booking) => {
            const revenue = bookingRevenue(booking);
            const operatingCost = bookingOperatingCost(booking);
            const profit = Number((revenue - operatingCost).toFixed(2));
            const marginPct = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;
            return {
                id: booking.id,
                dealerId: booking.dealerId,
                dealer: booking.dealer || null,
                deliveredAt: booking.deliveredAt,
                revenue,
                operatingCost,
                profit,
                marginPct,
                invoiceStatus: booking.invoice?.status || null,
            };
        });

        const dealerAggMap = new Map();
        rows.forEach((row) => {
            const current = dealerAggMap.get(row.dealerId) || {
                dealerId: row.dealerId,
                dealerName: row.dealer?.name || 'Unknown',
                dealerEmail: row.dealer?.email || null,
                dealerCompany: row.dealer?.company || null,
                deliveredTrips: 0,
                revenue: 0,
                operatingCost: 0,
                profit: 0,
                payoutEligibleTrips: 0,
            };
            current.deliveredTrips += 1;
            current.revenue += row.revenue;
            current.operatingCost += row.operatingCost;
            current.profit += row.profit;
            if (row.invoiceStatus === 'PAID') current.payoutEligibleTrips += 1;
            dealerAggMap.set(row.dealerId, current);
        });

        const dealerBreakdown = Array.from(dealerAggMap.values()).map((d) => {
            const marginPct = d.revenue > 0 ? Number(((d.profit / d.revenue) * 100).toFixed(2)) : 0;
            return {
                ...d,
                revenue: Number(d.revenue.toFixed(2)),
                operatingCost: Number(d.operatingCost.toFixed(2)),
                profit: Number(d.profit.toFixed(2)),
                marginPct,
            };
        });

        const monthlyProfit = seriesFromRecords(rows, months, {
            dateKey: 'deliveredAt',
            valueGetter: (row) => row.profit,
            valueKey: 'profit',
        });

        const topDealers = [...dealerBreakdown]
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);
        const lowMarginDealers = [...dealerBreakdown]
            .filter((d) => d.deliveredTrips >= 1)
            .sort((a, b) => a.marginPct - b.marginPct)
            .slice(0, 5);

        const totalRevenue = Number(rows.reduce((s, r) => s + r.revenue, 0).toFixed(2));
        const totalOperatingCost = Number(rows.reduce((s, r) => s + r.operatingCost, 0).toFixed(2));
        const totalProfit = Number((totalRevenue - totalOperatingCost).toFixed(2));
        const avgMarginPct = totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0;
        const payoutEligibleTrips = dealerBreakdown.reduce((s, d) => s + d.payoutEligibleTrips, 0);

        res.json({
            success: true,
            metrics: {
                activeDealers: dealerBreakdown.length,
                deliveredTrips: rows.length,
                totalRevenue,
                totalOperatingCost,
                totalProfit,
                avgMarginPct,
                payoutEligibleTrips,
            },
            monthlyProfit,
            topDealers,
            lowMarginDealers,
            dealerBreakdown,
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

module.exports = { getWarehouseAnalytics, getDealerAnalytics, getDealerEarnings, getAdminEarnings, getAdminAnalytics };
