/**
 * MODULE 5 — OPTIMIZATION ENGINE
 *
 * Pipeline:
 *  1. Load available trucks
 *  2. Filter  → remove trucks that can't handle the shipment
 *  3. Score   → utilization, distance match, cost efficiency, CO₂
 *  4. Rank    → weighted composite score
 *  5. Return  → top N results with full breakdown
 */

const { prisma } = require('../config/db');
const { haversineKm } = require('./routeService');
const logger = require('../config/logger');

// Scoring weights (must sum to 1.0)
const WEIGHTS = {
    utilization: 0.35,
    distanceMatch: 0.25,
    costEfficiency: 0.25,
    co2: 0.15,
};

const WEIGHT_SUM = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
    throw new Error(`Optimization weights must sum to 1.0, got ${WEIGHT_SUM}`);
}

// CO₂ emission factors (kg per km) by truck type
const CO2_PER_KM = {
    SMALL_VAN: 0.18,
    CONTAINER_20FT: 0.55,
    CONTAINER_32FT: 0.72,
    FLATBED_TRAILER: 0.80,
    REEFER: 0.90,
};

// ── Step 1: Load candidates ──────────────────────────────────────────────────
async function loadCandidates(shipment) {
    return prisma.truck.findMany({
        where: {
            status: 'AVAILABLE',
            availability: true,
            capacityKg: { gte: shipment.weightKg },
            ...(shipment.volumeM3
                ? {
                    OR: [
                        { capacityM3: null },
                        { capacityM3: { gte: shipment.volumeM3 } },
                    ],
                }
                : {}),
        },
        include: { dealer: { select: { id: true, name: true, company: true } } },
    });
}

// ── Step 2: Filter ───────────────────────────────────────────────────────────
function filterTrucks(trucks, shipment) {
    return trucks.filter((truck) => {
        // Capacity check
        if (truck.capacityKg < shipment.weightKg) return false;
        if (shipment.volumeM3 && truck.capacityM3 && truck.capacityM3 < shipment.volumeM3) return false;

        // Route match (loose — if dealer specified a route, prefer it but don't hard-block)
        // Hard block only if both routeFrom/routeTo are set and neither matches
        if (truck.routeFrom && truck.routeTo) {
            const fromCity = (shipment.pickupLocation?.city || '').toLowerCase();
            const toCity = (shipment.destination?.city || '').toLowerCase();
            const truckFrom = truck.routeFrom.toLowerCase();
            const truckTo = truck.routeTo.toLowerCase();
            if (!fromCity.includes(truckFrom) && !truckFrom.includes(fromCity)) return false;
            if (!toCity.includes(truckTo) && !truckTo.includes(toCity)) return false;
        }

        return true;
    });
}

// ── Step 3: Score ────────────────────────────────────────────────────────────
function scoreTruck(truck, shipment, distanceKm) {
    // 1. Utilization score — how well the shipment fills the truck (closer to 1 = better)
    const weightUtil = shipment.weightKg / truck.capacityKg;
    const volUtil = (shipment.volumeM3 && truck.capacityM3)
        ? shipment.volumeM3 / truck.capacityM3
        : weightUtil;
    const utilizationScore = Math.min((weightUtil + volUtil) / 2, 1.0);

    // 2. Distance match score — trucks with shorter routes score higher (normalised 0-1)
    //    We use a decay: score = 1 / (1 + distanceKm / 500)
    const distanceMatchScore = 1 / (1 + distanceKm / 500);

    // 3. Cost efficiency score — lower price per km = higher score
    //    Normalise against a baseline of ₹50/km
    const BASELINE_PRICE = 50;
    const pricePerKm = truck.pricePerKm || BASELINE_PRICE;
    const costEfficiencyScore = Math.min(BASELINE_PRICE / pricePerKm, 1.0);

    // 4. CO₂ score — lower emissions = higher score
    const co2PerKm = CO2_PER_KM[truck.truckType] || 0.60;
    const maxCo2 = CO2_PER_KM['REEFER'];
    const co2Score = 1 - co2PerKm / maxCo2;

    const composite =
        WEIGHTS.utilization * utilizationScore +
        WEIGHTS.distanceMatch * distanceMatchScore +
        WEIGHTS.costEfficiency * costEfficiencyScore +
        WEIGHTS.co2 * co2Score;

    return {
        score: parseFloat(composite.toFixed(4)),
        breakdown: {
            utilizationScore: parseFloat(utilizationScore.toFixed(4)),
            distanceMatchScore: parseFloat(distanceMatchScore.toFixed(4)),
            costEfficiencyScore: parseFloat(costEfficiencyScore.toFixed(4)),
            co2Score: parseFloat(co2Score.toFixed(4)),
        },
        estimatedCost: parseFloat((pricePerKm * distanceKm).toFixed(2)),
        estimatedCo2Kg: parseFloat((co2PerKm * distanceKm).toFixed(2)),
    };
}

// ── Main entry point ─────────────────────────────────────────────────────────
async function run(shipment, topN = 5) {
    logger.info(`Optimization started for shipment ${shipment.id}`);

    const allTrucks = await loadCandidates(shipment);
    const filtered = filterTrucks(allTrucks, shipment);

    if (filtered.length === 0) {
        logger.warn(`No eligible trucks for shipment ${shipment.id}`);
        return { eligible: 0, results: [] };
    }

    const origin = shipment.pickupLocation;
    const dest = shipment.destination;
    const distanceKm = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);

    const scored = filtered.map((truck) => {
        const { score, breakdown, estimatedCost, estimatedCo2Kg } = scoreTruck(truck, shipment, distanceKm);
        return {
            truckId: truck.id,
            registrationNo: truck.registrationNo,
            truckType: truck.truckType,
            capacityKg: truck.capacityKg,
            capacityM3: truck.capacityM3,
            routeFrom: truck.routeFrom,
            routeTo: truck.routeTo,
            pricePerKm: truck.pricePerKm,
            dealer: truck.dealer,
            score,
            breakdown,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            estimatedCost,
            estimatedCo2Kg,
        };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topN);

    logger.info(`Optimization complete for ${shipment.id}: ${filtered.length} eligible, top ${results.length} returned`);
    return { eligible: filtered.length, distanceKm: parseFloat(distanceKm.toFixed(2)), results };
}

module.exports = { run };
