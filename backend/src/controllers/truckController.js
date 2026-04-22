const { prisma } = require('../config/db');
const logger = require('../config/logger');
const { parsePagination } = require('../helpers/pagination');

// Dealer: add truck
async function createTruck(req, res, next) {
  try {
    const { registrationNo, truckType, capacityKg, capacityM3, routeFrom, routeTo, pricePerKm } = req.body;

    const truck = await prisma.truck.create({
      data: {
        dealerId: req.user.id,
        registrationNo,
        truckType,
        capacityKg,
        capacityM3: capacityM3 || null,
        routeFrom,
        routeTo,
        pricePerKm: pricePerKm || null,
        status: 'AVAILABLE',
        availability: true,
      },
    });

    logger.info(`Truck added: ${truck.registrationNo} by dealer ${req.user.id}`);
    res.status(201).json({ success: true, truck });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Registration number already exists' });
    }
    next(err);
  }
}

// Dealer: get own trucks
async function getMyTrucks(req, res, next) {
  try {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const where = { dealerId: req.user.id };
    if (status) where.status = status;

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.truck.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trucks });
  } catch (err) {
    next(err);
  }
}

// Admin: get all trucks
async function getAllTrucks(req, res, next) {
  try {
    const { status, truckType, dealerId } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (status) where.status = status;
    if (truckType) where.truckType = truckType;
    if (dealerId) where.dealerId = dealerId;

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        include: { dealer: { select: { id: true, name: true, email: true, company: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.truck.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trucks });
  } catch (err) {
    next(err);
  }
}

// Public (authenticated): available trucks for optimization
async function getAvailableTrucks(req, res, next) {
  try {
    const { minCapacityKg, truckType, routeFrom, routeTo } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 100, 50);
    const where = { status: 'AVAILABLE', availability: true };
    if (truckType) where.truckType = truckType;
    if (minCapacityKg) where.capacityKg = { gte: parseFloat(minCapacityKg) };
    if (routeFrom) where.routeFrom = { contains: routeFrom, mode: 'insensitive' };
    if (routeTo)   where.routeTo   = { contains: routeTo,   mode: 'insensitive' };

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        include: { dealer: { select: { id: true, name: true, company: true } } },
        orderBy: { capacityKg: 'asc' },
        skip,
        take: limit,
      }),
      prisma.truck.count({ where }),
    ]);

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trucks });
  } catch (err) {
    next(err);
  }
}

// Get single truck
async function getTruck(req, res, next) {
  try {
    const truck = await prisma.truck.findUnique({
      where: { id: req.params.id },
      include: {
        dealer: { select: { id: true, name: true, email: true, phone: true, company: true } },
        bookings: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    res.json({ success: true, truck });
  } catch (err) {
    next(err);
  }
}

// Dealer: update own truck
async function updateTruck(req, res, next) {
  try {
    const truck = await prisma.truck.findUnique({ where: { id: req.params.id } });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    if (truck.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Only include fields that were actually provided — never send undefined to Prisma
    // as it can silently nullify non-nullable columns.
    const { truckType, capacityKg, capacityM3, routeFrom, routeTo, pricePerKm, availability, status } = req.body;
    const data = {};
    if (truckType    !== undefined) data.truckType    = truckType;
    if (capacityKg   !== undefined) data.capacityKg   = capacityKg;
    if (capacityM3   !== undefined) data.capacityM3   = capacityM3;
    if (routeFrom    !== undefined) data.routeFrom    = routeFrom;
    if (routeTo      !== undefined) data.routeTo      = routeTo;
    if (pricePerKm   !== undefined) data.pricePerKm   = pricePerKm;
    if (availability !== undefined) data.availability = availability;
    if (status       !== undefined) data.status       = status;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    const updated = await prisma.truck.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, truck: updated });
  } catch (err) {
    next(err);
  }
}

// Dealer: update truck GPS location
async function updateTruckLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;

    const truck = await prisma.truck.findUnique({ where: { id: req.params.id } });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    if (truck.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await prisma.truck.update({
      where: { id: req.params.id },
      data: { currentLocation: { lat, lng, lastUpdated: new Date() } },
    });

    const io = req.app.get('io');
    io.to(`truck:${truck.id}`).emit('truck:location', { truckId: truck.id, location: updated.currentLocation });

    res.json({ success: true, truck: updated });
  } catch (err) {
    next(err);
  }
}

// Admin: delete truck
async function deleteTruck(req, res, next) {
  try {
    await prisma.truck.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Truck deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Truck not found' });
    next(err);
  }
}

module.exports = {
  createTruck,
  getMyTrucks,
  getAllTrucks,
  getAvailableTrucks,
  getTruck,
  updateTruck,
  updateTruckLocation,
  deleteTruck,
};
