const { prisma } = require('../config/db');

function parseRangeDays(query = {}, defaultDays = 30, maxDays = 365) {
  const raw = Number.parseInt(query.days, 10);
  if (!Number.isFinite(raw) || raw <= 0) return defaultDays;
  return Math.min(raw, maxDays);
}

function parseGranularity(query = {}, allowed = ['day', 'week', 'month']) {
  return allowed.includes(query.granularity) ? query.granularity : 'day';
}

function getRangeStart(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function formatBucket(date, granularity) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);

  if (granularity === 'month') {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  if (granularity === 'week') {
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - day + 1);
  }

  return value.toISOString().slice(0, 10);
}

function seriesFromRecords(records, { dateKey, valueKey, granularity }) {
  const totals = new Map();

  for (const record of records) {
    const date = record?.[dateKey];
    if (!date) continue;

    const bucket = formatBucket(date, granularity);
    const value = valueKey ? Number(record?.[valueKey] || 0) : 1;
    totals.set(bucket, (totals.get(bucket) || 0) + value);
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, value]) => ({
      bucket,
      value: Number(value.toFixed(2)),
    }));
}

function groupedStatusCounts(rows, labelKey = 'status') {
  return Object.fromEntries(rows.map((row) => [row[labelKey], row._count._all]));
}

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

    const totalDistanceKm = bookings.reduce((sum, booking) => sum + (booking.distanceKm || 0), 0);
    const deliveredCount = bookings.length;

    const etaPredictions = predictions.filter((prediction) => prediction.type === 'ETA_HOURS');
    const avgEta = etaPredictions.length
      ? etaPredictions.reduce((sum, prediction) => sum + prediction.value, 0) / etaPredictions.length
      : null;

    const co2Predictions = predictions.filter((prediction) => prediction.type === 'CO2_KG');
    const totalCo2Saved = co2Predictions.reduce((sum, prediction) => sum + prediction.value, 0);

    res.json({
      success: true,
      analytics: {
        totalShipments,
        byStatus: groupedStatusCounts(byStatus),
        deliveredCount,
        totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
        avgEtaHours: avgEta !== null ? Number(avgEta.toFixed(2)) : null,
        totalCo2SavedKg: Number(totalCo2Saved.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getWarehouseAnalyticsCharts(req, res, next) {
  try {
    const warehouseId = req.user.id;
    const days = parseRangeDays(req.query);
    const granularity = parseGranularity(req.query);
    const startDate = getRangeStart(days);

    const [shipments, deliveredBookings, predictions] = await Promise.all([
      prisma.shipment.findMany({
        where: { warehouseId, createdAt: { gte: startDate } },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.booking.findMany({
        where: { warehouseId, status: 'DELIVERED', deliveredAt: { gte: startDate } },
        select: { deliveredAt: true, distanceKm: true },
        orderBy: { deliveredAt: 'asc' },
      }),
      prisma.prediction.findMany({
        where: {
          shipment: { warehouseId },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, type: true, value: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const etaSeries = seriesFromRecords(
      predictions.filter((prediction) => prediction.type === 'ETA_HOURS'),
      { dateKey: 'createdAt', valueKey: 'value', granularity },
    );
    const fuelSeries = seriesFromRecords(
      predictions.filter((prediction) => prediction.type === 'FUEL_ESTIMATE_LITERS'),
      { dateKey: 'createdAt', valueKey: 'value', granularity },
    );
    const co2Series = seriesFromRecords(
      predictions.filter((prediction) => prediction.type === 'CO2_KG'),
      { dateKey: 'createdAt', valueKey: 'value', granularity },
    );

    res.json({
      success: true,
      range: { days, granularity, startDate: startDate.toISOString() },
      charts: {
        shipmentsCreated: seriesFromRecords(shipments, { dateKey: 'createdAt', granularity }),
        shipmentsDelivered: seriesFromRecords(deliveredBookings, { dateKey: 'deliveredAt', granularity }),
        deliveredDistanceKm: seriesFromRecords(deliveredBookings, {
          dateKey: 'deliveredAt',
          valueKey: 'distanceKm',
          granularity,
        }),
        etaHours: etaSeries,
        fuelEstimateLiters: fuelSeries,
        co2Kg: co2Series,
      },
    });
  } catch (err) {
    next(err);
  }
}

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

    const totalKm = deliveredBookings.reduce((sum, booking) => sum + (booking.distanceKm || 0), 0);
    const avgScore = deliveredBookings.length
      ? deliveredBookings.reduce((sum, booking) => sum + (booking.optimScore || 0), 0) / deliveredBookings.length
      : null;

    const availableCount = trucksByStatus.find((truck) => truck.status === 'AVAILABLE')?._count?._all || 0;
    const utilizationPct = totalTrucks > 0
      ? Number((((totalTrucks - availableCount) / totalTrucks) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      analytics: {
        totalTrucks,
        trucksByStatus: groupedStatusCounts(trucksByStatus),
        bookingsByStatus: groupedStatusCounts(bookingsByStatus),
        totalDeliveredKm: Number(totalKm.toFixed(2)),
        avgOptimizationScore: avgScore !== null ? Number(avgScore.toFixed(3)) : null,
        fleetUtilizationPct: utilizationPct,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getDealerAnalyticsCharts(req, res, next) {
  try {
    const dealerId = req.user.id;
    const days = parseRangeDays(req.query);
    const granularity = parseGranularity(req.query);
    const startDate = getRangeStart(days);

    const [bookings, trucks] = await Promise.all([
      prisma.booking.findMany({
        where: { dealerId, createdAt: { gte: startDate } },
        select: { createdAt: true, deliveredAt: true, distanceKm: true, optimScore: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.truck.findMany({
        where: { dealerId, createdAt: { gte: startDate } },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const delivered = bookings.filter((booking) => booking.status === 'DELIVERED' && booking.deliveredAt);
    const scoreSeries = seriesFromRecords(
      delivered.map((booking) => ({ deliveredAt: booking.deliveredAt, value: booking.optimScore || 0 })),
      { dateKey: 'deliveredAt', valueKey: 'value', granularity },
    );

    res.json({
      success: true,
      range: { days, granularity, startDate: startDate.toISOString() },
      charts: {
        bookingsCreated: seriesFromRecords(bookings, { dateKey: 'createdAt', granularity }),
        deliveredDistanceKm: seriesFromRecords(delivered, {
          dateKey: 'deliveredAt',
          valueKey: 'distanceKm',
          granularity,
        }),
        optimizationScore: scoreSeries,
        trucksAdded: seriesFromRecords(trucks, { dateKey: 'createdAt', granularity }),
      },
    });
  } catch (err) {
    next(err);
  }
}

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
    const totalKm = deliveredBookings.reduce((sum, booking) => sum + (booking.distanceKm || 0), 0);

    res.json({
      success: true,
      analytics: {
        users: { total: totalUsers, byRole: groupedStatusCounts(usersByRole, 'role') },
        shipments: { total: totalShipments, byStatus: groupedStatusCounts(shipmentsByStatus) },
        trucks: { total: totalTrucks, byStatus: groupedStatusCounts(trucksByStatus) },
        bookings: { total: totalBookings, byStatus: groupedStatusCounts(bookingsByStatus) },
        totalDeliveredKm: Number(totalKm.toFixed(2)),
      },
      recentBookings,
    });
  } catch (err) {
    next(err);
  }
}

async function getAdminAnalyticsCharts(req, res, next) {
  try {
    const days = parseRangeDays(req.query, 60);
    const granularity = parseGranularity(req.query);
    const startDate = getRangeStart(days);

    const [users, shipments, bookings, predictions] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.shipment.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.booking.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, deliveredAt: true, distanceKm: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.prediction.findMany({
        where: { createdAt: { gte: startDate }, type: 'CO2_KG' },
        select: { createdAt: true, value: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const delivered = bookings.filter((booking) => booking.status === 'DELIVERED' && booking.deliveredAt);

    res.json({
      success: true,
      range: { days, granularity, startDate: startDate.toISOString() },
      charts: {
        usersRegistered: seriesFromRecords(users, { dateKey: 'createdAt', granularity }),
        shipmentsCreated: seriesFromRecords(shipments, { dateKey: 'createdAt', granularity }),
        bookingsCreated: seriesFromRecords(bookings, { dateKey: 'createdAt', granularity }),
        deliveredDistanceKm: seriesFromRecords(delivered, {
          dateKey: 'deliveredAt',
          valueKey: 'distanceKm',
          granularity,
        }),
        co2Kg: seriesFromRecords(predictions, { dateKey: 'createdAt', valueKey: 'value', granularity }),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWarehouseAnalytics,
  getWarehouseAnalyticsCharts,
  getDealerAnalytics,
  getDealerAnalyticsCharts,
  getAdminAnalytics,
  getAdminAnalyticsCharts,
};
