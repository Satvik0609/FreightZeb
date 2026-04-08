const mlService = require('../services/mlService');
const { prisma } = require('../config/db');

async function getTruckRecommendation(req, res) {
  try {
    const { weight_kg, volume_m3, distance_km, cargo_type, priority } = req.query;

    if (!weight_kg || !volume_m3 || !distance_km) {
      return res.status(400).json({ 
        message: 'Missing required parameters: weight_kg, volume_m3, distance_km' 
      });
    }

    const result = await mlService.predictTruckRecommendation({
      weight_kg: parseFloat(weight_kg),
      volume_m3: parseFloat(volume_m3),
      distance_km: parseFloat(distance_km),
      cargo_type: cargo_type || 'GENERAL',
      priority: priority || 'NORMAL'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function predictDeliveryTime(req, res) {
  try {
    const { shipmentId } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { routes: { include: { truck: true } } }
    });

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const route = shipment.routes[0];
    if (!route) {
      return res.status(400).json({ message: 'No route assigned to shipment' });
    }

    const result = await mlService.predictDeliveryTime(shipment, route);

    await prisma.prediction.create({
      data: {
        shipmentId,
        type: 'ETA_HOURS',
        value: result.predicted_hours,
        confidence: result.confidence,
        modelVersion: '1.0.0'
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function clusterShipments(req, res) {
  try {
    const { status } = req.query;
    
    const shipments = await prisma.shipment.findMany({
      where: status ? { status } : { status: 'PENDING' },
      select: {
        id: true,
        destination: true,
        weightKg: true,
        volumeM3: true
      }
    });

    if (shipments.length < 2) {
      return res.json({
        message: 'Not enough shipments for clustering',
        num_clusters: 0
      });
    }

    const formattedShipments = shipments.map(s => ({
      id: s.id,
      destination: s.destination,
      weight_kg: s.weightKg,
      volume_m3: s.volumeM3
    }));

    const result = await mlService.clusterShipments(formattedShipments);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function predictDelayRisk(req, res) {
  try {
    const { shipmentId } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { routes: { include: { truck: true } } }
    });

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const route = shipment.routes[0];
    if (!route) {
      return res.status(400).json({ message: 'No route assigned' });
    }

    const result = await mlService.predictDelayRisk({
      distance_km: route.distanceKm,
      weight_kg: shipment.weightKg,
      truck_type: route.truck.type,
      weather_condition: req.query.weather || 'CLEAR',
      traffic_condition: req.query.traffic || 'MODERATE',
      time_of_day: req.query.time_of_day || 'AFTERNOON'
    });

    await prisma.prediction.create({
      data: {
        shipmentId,
        type: 'DELAY_RISK_PERCENT',
        value: result.risk_score,
        confidence: result.confidence,
        modelVersion: '1.0.0'
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function estimateFuel(req, res) {
  try {
    const { distance_km, weight_kg, truck_type } = req.query;

    if (!distance_km || !weight_kg || !truck_type) {
      return res.status(400).json({ 
        message: 'Missing required parameters: distance_km, weight_kg, truck_type' 
      });
    }

    const result = await mlService.estimateFuel({
      distance_km: parseFloat(distance_km),
      weight_kg: parseFloat(weight_kg),
      truck_type
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function optimizeCargo(req, res) {
  try {
    const { truck_capacity_kg, truck_capacity_m3, items } = req.body;

    if (!truck_capacity_kg || !truck_capacity_m3 || !items) {
      return res.status(400).json({ 
        message: 'Missing required parameters: truck_capacity_kg, truck_capacity_m3, items' 
      });
    }

    const result = await mlService.optimizeCargo({
      truck_capacity_kg,
      truck_capacity_m3,
      items
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getTruckRecommendation,
  predictDeliveryTime,
  clusterShipments,
  predictDelayRisk,
  estimateFuel,
  optimizeCargo
};
