/**
 * Route calculation utilities.
 * Uses Haversine formula for straight-line distance estimation.
 * Replace calculateRoute() with Google Maps / OSRM for real road distances.
 */

const AVERAGE_SPEED_KMH = 60;

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateRoute(origin, destination) {
    const distanceKm = parseFloat(haversineKm(origin.lat, origin.lng, destination.lat, destination.lng).toFixed(2));
    const durationMin = Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
    return { distanceKm, durationMin };
}

/**
 * Pick the most appropriate truck type based on shipment weight.
 * Used as a starting point — optimization engine refines further.
 */
function pickTruckType(weightKg) {
    if (weightKg <= 1500) return 'SMALL_VAN';
    if (weightKg <= 10000) return 'CONTAINER_20FT';
    if (weightKg <= 25000) return 'CONTAINER_32FT';
    return 'FLATBED_TRAILER';
}

module.exports = { haversineKm, calculateRoute, pickTruckType };
