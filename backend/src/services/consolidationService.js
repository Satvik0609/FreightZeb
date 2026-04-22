const { prisma } = require('../config/db');
const { haversineKm } = require('./routeService');

const CONSOLIDATION_RADIUS_KM = 50;

function normalizeShipmentForConsolidation(shipment) {
  const destinationLat = Number(shipment.destination?.lat);
  const destinationLng = Number(shipment.destination?.lng);

  if (!Number.isFinite(destinationLat) || !Number.isFinite(destinationLng)) {
    return null;
  }

  return {
    id: shipment.id,
    destination_lat: destinationLat,
    destination_lng: destinationLng,
    weight: shipment.weightKg,
    volume: shipment.volumeM3,
  };
}

function clusterShipments(shipments) {
  const clusters = [];
  let clusterId = 1;

  for (const shipment of shipments) {
    // Improvement: evaluate ALL centroid distances, keep only eligible clusters
    // (distance < 50km), then pick the nearest centroid among eligible ones.
    const eligibleClusters = clusters
      .map((candidate) => ({
        candidate,
        distanceKm: haversineKm(
          shipment.destination_lat,
          shipment.destination_lng,
          candidate.centroid.lat,
          candidate.centroid.lng
        ),
      }))
      .filter((item) => item.distanceKm < CONSOLIDATION_RADIUS_KM);

    const nearestEligible = eligibleClusters.reduce((best, current) => {
      if (!best || current.distanceKm < best.distanceKm) {
        return current;
      }
      return best;
    }, null);

    const bestCluster = nearestEligible?.candidate || null;

    if (bestCluster) {
      bestCluster.shipments.push(shipment);
      const count = bestCluster.shipments.length;
      bestCluster.centroid.lat =
        (bestCluster.centroid.lat * (count - 1) + shipment.destination_lat) / count;
      bestCluster.centroid.lng =
        (bestCluster.centroid.lng * (count - 1) + shipment.destination_lng) / count;
    } else {
      clusters.push({
        cluster_id: clusterId,
        centroid: {
          lat: shipment.destination_lat,
          lng: shipment.destination_lng,
        },
        shipments: [shipment],
      });
      clusterId += 1;
    }
  }

  return clusters.map(({ cluster_id, shipments }) => ({ cluster_id, shipments }));
}

async function consolidateShipments() {
  try {
    const shipments = await prisma.shipment.findMany({
      // Only consolidate PENDING shipments — OPTIMIZED already have a scored truck,
      // BOOKED already have a booking, so re-consolidating them is meaningless.
      where: { status: 'PENDING' },
      select: {
        id: true,
        destination: true,
        weightKg: true,
        volumeM3: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!shipments.length) {
      const error = new Error('No shipments found for consolidation');
      error.statusCode = 404;
      throw error;
    }

    const normalized = shipments.map(normalizeShipmentForConsolidation).filter(Boolean);

    if (!normalized.length) {
      const error = new Error('No shipments contain valid destination coordinates');
      error.statusCode = 404;
      throw error;
    }

    const clusters = clusterShipments(normalized);
    return { clusters };
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = 'Failed to consolidate shipments';
    }
    throw error;
  }
}

module.exports = { consolidateShipments };
