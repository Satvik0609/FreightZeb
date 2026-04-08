const { prisma } = require('../config/db');

async function createTruck(req, res) {
  try {
    const { registrationNo, type, capacityKg, capacityM3, currentLocation } = req.body;

    if (!registrationNo || !type || !capacityKg) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const truck = await prisma.truck.create({
      data: {
        registrationNo,
        type,
        capacityKg,
        capacityM3,
        currentLocation,
        status: 'AVAILABLE'
      }
    });

    res.status(201).json(truck);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function getAllTrucks(req, res) {
  try {
    const { status, type } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const trucks = await prisma.truck.findMany({
      where,
      include: {
        _count: {
          select: { deliveries: true, routes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(trucks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getTruck(req, res) {
  try {
    const truck = await prisma.truck.findUnique({
      where: { id: req.params.id },
      include: {
        routes: {
          include: { shipment: true }
        },
        deliveries: {
          include: { shipment: true }
        }
      }
    });

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    res.json(truck);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateTruck(req, res) {
  try {
    const { status, currentLocation } = req.body;

    const truck = await prisma.truck.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(currentLocation && { currentLocation })
      }
    });

    res.json(truck);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function deleteTruck(req, res) {
  try {
    await prisma.truck.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Truck deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = {
  createTruck,
  getAllTrucks,
  getTruck,
  updateTruck,
  deleteTruck
};
