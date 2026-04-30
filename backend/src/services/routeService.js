/**
 * Route calculation utilities.
 * Primary: Google Maps Directions API — real road distance, duration, traffic, steps.
 * Fallback: Haversine formula (straight-line) if API key missing or call fails.
 */

const axios = require('axios');
const logger = require('../config/logger');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
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

async function _fetchGoogleMapsRoute(origin, destination) {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') return null;

    try {
        const { data } = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`,
                units: 'metric',
                departure_time: 'now',
                traffic_model: 'best_guess',
                key: GOOGLE_MAPS_API_KEY,
            },
            timeout: 6000,
        });

        if (data.status !== 'OK' || !data.routes?.length) {
            logger.warn(`Google Maps Directions API: ${data.status}`);
            return null;
        }

        const leg = data.routes[0].legs[0];
        const distanceKm = parseFloat((leg.distance.value / 1000).toFixed(2));
        const durationMin = Math.round(leg.duration.value / 60);
        const durationInTrafficMin = leg.duration_in_traffic
            ? Math.round(leg.duration_in_traffic.value / 60) : null;

        return {
            distanceKm,
            durationMin,
            distanceText: leg.distance.text,
            durationText: leg.duration.text,
            durationInTrafficMin,
            durationInTrafficText: leg.duration_in_traffic?.text || null,
            trafficDelayMin: durationInTrafficMin != null
                ? Math.max(0, durationInTrafficMin - durationMin) : null,
            source: 'google_maps',
        };
    } catch (err) {
        logger.warn(`Google Maps API error: ${err.message} — falling back to Haversine`);
        return null;
    }
}

/**
 * Calculate route. Tries Google Maps first, falls back to Haversine.
 * Always async — await this everywhere.
 */
async function calculateRoute(origin, destination) {
    const google = await _fetchGoogleMapsRoute(origin, destination);
    if (google) return google;

    const distanceKm = parseFloat(haversineKm(origin.lat, origin.lng, destination.lat, destination.lng).toFixed(2));
    const durationMin = Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
    return { distanceKm, durationMin, source: 'haversine' };
}

function pickTruckType(weightKg) {
    if (weightKg <= 1500) return 'SMALL_VAN';
    if (weightKg <= 10000) return 'CONTAINER_20FT';
    if (weightKg <= 25000) return 'CONTAINER_32FT';
    return 'FLATBED_TRAILER';
}

module.exports = { haversineKm, calculateRoute, pickTruckType };
