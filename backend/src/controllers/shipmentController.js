const { prisma } = require('../config/db');
const shipmentService = require('../services/shipmentService');

async function createShipment(req, res) {
  try {
    const data = req.body;
    const customerId = req.user.id;

    const shipment = await prisma.shipment.create({
      data: {
        ...data,
        customerId,
        status: 'PENDING',
      },
    });

    shipmentService.processNewShipment(shipment.id).catch(err => {
      console.error('Background shipment processing failed:', err);
    });

    res.status(201).json(shipment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function getMyShipments(req, res) {
  const shipments = await prisma.shipment.findMany({
    where: { customerId: req.user.id },
    include: {
      routes: { include: { truck: true } },
      deliveries: true,
      predictions: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(shipments);
}

async function getShipment(req, res) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: req.params.id },
    include: {
      routes: { include: { truck: true, delivery: true } },
      deliveries: true,
      predictions: true,
    },
  });

  if (!shipment) return res.status(404).json({ message: 'Not found' });

  // Optional: only allow owner or admin/dispatcher
  if (shipment.customerId !== req.user.id && !['ADMIN', 'DISPATCHER'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  res.json(shipment);
}

module.exports = {
  createShipment,
  getMyShipments,
  getShipment,
};