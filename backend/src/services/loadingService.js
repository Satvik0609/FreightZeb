const { prisma } = require('../config/db');

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive number`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function resolveShipmentDimensions(shipment) {
  const reqDims = shipment.requirements?.dimensions || {};

  const length = Number(reqDims.length);
  const width = Number(reqDims.width);
  const height = Number(reqDims.height);

  if (Number.isFinite(length) && Number.isFinite(width) && Number.isFinite(height)) {
    if (length > 0 && width > 0 && height > 0) {
      return { length, width, height };
    }
  }

  if (shipment.volumeM3 && shipment.volumeM3 > 0) {
    const edge = Number(Math.cbrt(shipment.volumeM3).toFixed(4));
    return { length: edge, width: edge, height: edge };
  }

  const error = new Error(`Dimensions unavailable for shipment ${shipment.id}`);
  error.statusCode = 400;
  throw error;
}

function getOrientationCandidates(dimensions) {
  const base = [
    { length: dimensions.length, width: dimensions.width, height: dimensions.height },
    { length: dimensions.width, width: dimensions.length, height: dimensions.height },
    { length: dimensions.height, width: dimensions.width, height: dimensions.length },
  ];

  const unique = new Map();
  for (const orientation of base) {
    const key = `${orientation.length}|${orientation.width}|${orientation.height}`;
    if (!unique.has(key)) {
      unique.set(key, orientation);
    }
  }

  return [...unique.values()];
}

function fitsInRemainingSpace(position, orientation, truck) {
  return (
    position.x + orientation.length <= truck.length &&
    position.y + orientation.width <= truck.width &&
    position.z + orientation.height <= truck.height
  );
}

function selectBestOrientation(orientations, position, truck) {
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const orientation of orientations) {
    if (!fitsInRemainingSpace(position, orientation, truck)) {
      continue;
    }

    // Smaller leftover volume indicates a tighter fit at this first-fit position.
    const remainingLength = truck.length - (position.x + orientation.length);
    const remainingWidth = truck.width - (position.y + orientation.width);
    const remainingHeight = truck.height - (position.z + orientation.height);
    const score = remainingLength * remainingWidth * remainingHeight;

    if (score < bestScore) {
      bestScore = score;
      best = orientation;
    }
  }

  return best;
}

function placeShipmentsInTruck(truck, shipmentsWithDimensions) {
  const placements = [];
  const truckVolume = truck.length * truck.width * truck.height;

  let x = 0;
  let y = 0;
  let z = 0;
  let rowDepth = 0;
  let layerHeight = 0;
  let usedVolume = 0;
  let totalWeightPlaced = 0;
  const unplaced = [];

  for (const shipment of shipmentsWithDimensions) {
    // Weight constraint: skip shipment if adding it would exceed truck max weight.
    if (totalWeightPlaced + shipment.weightKg > truck.maxWeight) {
      unplaced.push({ shipment_id: shipment.id, reason: 'Weight capacity exceeded' });
      continue;
    }

    const orientations = getOrientationCandidates(shipment.dimensions);
    let currentPosition = { x, y, z };
    let selected = selectBestOrientation(orientations, currentPosition, truck);

    if (!selected) {
      currentPosition = { x: 0, y: y + rowDepth, z };
      selected = selectBestOrientation(orientations, currentPosition, truck);
    }

    if (!selected) {
      currentPosition = { x: 0, y: 0, z: z + layerHeight };
      selected = selectBestOrientation(orientations, currentPosition, truck);
    }

    if (!selected) {
      unplaced.push({ shipment_id: shipment.id, reason: 'Capacity exceeded' });
      continue;
    }

    x = currentPosition.x;
    y = currentPosition.y;
    z = currentPosition.z;

    placements.push({
      shipment_id: shipment.id,
      position: { x, y, z },
      dimensions: selected,
      weight: shipment.weightKg,
    });

    const placedVolume = selected.length * selected.width * selected.height;
    usedVolume += placedVolume;
    totalWeightPlaced += shipment.weightKg;
    x += selected.length;
    rowDepth = Math.max(rowDepth, selected.width);
    layerHeight = Math.max(layerHeight, selected.height);
  }

  // Utilization is based strictly on volume.
  const utilization = truckVolume > 0 ? Number(((usedVolume / truckVolume) * 100).toFixed(2)) : 0;
  const placed_count = placements.length;
  const unplaced_count = unplaced.length;
  const unplacedIds = unplaced.map((item) => item.shipment_id);
  const message =
    placements.length === 0
      ? 'No shipments could be placed within truck capacity'
      : unplaced.length > 0
      ? `${unplaced.length} shipment(s) could not be placed due to capacity limits`
      : 'All shipments were placed successfully';

  return {
    utilization,
    placed_count,
    unplaced_count,
    placements,
    unplaced: unplacedIds,
    // Backward compatibility for clients that need skip reasons.
    unplaced_details: unplaced,
    totalWeightPlaced,
    message,
  };
}

async function optimizeTruckLoading({ truck, shipmentIds }) {
  try {
    // TODO: Replace with ML service (FastAPI)
    const uniqueShipmentIds = [...new Set(shipmentIds)];
    if (uniqueShipmentIds.length === 0) {
      const error = new Error('shipmentIds must include at least one shipment id');
      error.statusCode = 400;
      throw error;
    }

    const shipments = await prisma.shipment.findMany({
      where: { id: { in: uniqueShipmentIds } },
      select: {
        id: true,
        weightKg: true,
        volumeM3: true,
        requirements: true,
      },
    });

    if (!shipments.length) {
      const error = new Error('No shipments found for provided shipmentIds');
      error.statusCode = 404;
      throw error;
    }

    if (shipments.length !== uniqueShipmentIds.length) {
      const foundIds = new Set(shipments.map((shipment) => shipment.id));
      const missing = uniqueShipmentIds.filter((id) => !foundIds.has(id));
      const error = new Error(`Some shipments were not found: ${missing.join(', ')}`);
      error.statusCode = 404;
      throw error;
    }

    const shipmentsWithDimensions = shipments.map((shipment) => ({
      ...shipment,
      dimensions: resolveShipmentDimensions(shipment),
    }));

    // Process larger shipments first for better packing efficiency.
    // Tie-break by shipment id to keep ordering deterministic.
    shipmentsWithDimensions.sort((a, b) => {
      const volumeA = a.dimensions.length * a.dimensions.width * a.dimensions.height;
      const volumeB = b.dimensions.length * b.dimensions.width * b.dimensions.height;
      if (volumeB !== volumeA) return volumeB - volumeA;
      return a.id.localeCompare(b.id);
    });

    return placeShipmentsInTruck(truck, shipmentsWithDimensions);
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = 'Failed to optimize truck loading';
    }
    throw error;
  }
}

function validateAndNormalizeLoadingInput(payload) {
  try {
    const truck = payload?.truck || {};
    const rawShipmentIds = payload?.shipmentIds;

    if (!Array.isArray(rawShipmentIds) || rawShipmentIds.length === 0) {
      const error = new Error('shipmentIds must be a non-empty array');
      error.statusCode = 400;
      throw error;
    }

    const shipmentIds = rawShipmentIds.map((id) => String(id).trim()).filter(Boolean);
    if (!shipmentIds.length) {
      const error = new Error('shipmentIds must contain valid values');
      error.statusCode = 400;
      throw error;
    }

    return {
      truck: {
        length: parsePositiveNumber(truck.length, 'truck.length'),
        width: parsePositiveNumber(truck.width, 'truck.width'),
        height: parsePositiveNumber(truck.height, 'truck.height'),
        maxWeight: parsePositiveNumber(truck.maxWeight, 'truck.maxWeight'),
      },
      shipmentIds,
    };
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 400;
      error.message = 'Invalid loading input';
    }
    throw error;
  }
}

module.exports = { optimizeTruckLoading, validateAndNormalizeLoadingInput };
