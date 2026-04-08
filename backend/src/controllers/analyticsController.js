const { prisma } = require('../config/db');

async function getAnalytics(req, res) {
  try {
    const [
      totalShipments,
      totalTrucks,
      activeDeliveries,
      completedDeliveries,
      shipmentsByStatus,
      trucksByStatus,
      recentPredictions
    ] = await Promise.all([
      prisma.shipment.count(),
      prisma.truck.count(),
      prisma.delivery.count({ where: { status: { in: ['PICKED_UP', 'IN_TRANSIT'] } } }),
      prisma.delivery.count({ where: { status: 'DELIVERED' } }),
      prisma.shipment.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.truck.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.prediction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { shipment: { select: { id: true, status: true } } }
      })
    ]);

    const avgDeliveryTime = await prisma.prediction.aggregate({
      where: { type: 'ETA_HOURS' },
      _avg: { value: true }
    });

    const truckUtilization = await calculateTruckUtilization();

    res.json({
      overview: {
        totalShipments,
        totalTrucks,
        activeDeliveries,
        completedDeliveries,
        avgDeliveryTimeHours: avgDeliveryTime._avg.value || 0,
        truckUtilizationPercent: truckUtilization
      },
      shipmentsByStatus: shipmentsByStatus.map(s => ({
        status: s.status,
        count: s._count
      })),
      trucksByStatus: trucksByStatus.map(t => ({
        status: t.status,
        count: t._count
      })),
      recentPredictions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function calculateTruckUtilization() {
  const trucks = await prisma.truck.findMany({
    select: { status: true }
  });

  if (trucks.length === 0) return 0;

  const activeTrucks = trucks.filter(t => 
    ['ASSIGNED', 'IN_TRANSIT'].includes(t.status)
  ).length;

  return Math.round((activeTrucks / trucks.length) * 100);
}

async function getShipmentTrends(req, res) {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const shipments = await prisma.shipment.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        createdAt: true,
        status: true
      }
    });

    const trendData = {};
    shipments.forEach(s => {
      const date = s.createdAt.toISOString().split('T')[0];
      if (!trendData[date]) {
        trendData[date] = { date, count: 0 };
      }
      trendData[date].count++;
    });

    const trends = Object.values(trendData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.json({ trends });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getAnalytics,
  getShipmentTrends
};
