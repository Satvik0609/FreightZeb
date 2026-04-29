/**
 * mapsService.js
 * Proxy + cache layer for Google Maps Platform APIs.
 * Keeps API keys server-side so they are never exposed to the browser.
 */

const axios  = require('axios');
const logger = require('../config/logger');

// ── In-memory route cache ─────────────────────────────────────────────────────
// Key: rounded-coordinate string  →  { data, expiresAt }
const _routeCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1_000; // 30 minutes

/** Round to 3 decimal places (≈ 111 m precision) for cache keying. */
function _round(n) {
  return Math.round(n * 1_000) / 1_000;
}

function _cacheKey(oLat, oLng, dLat, dLng) {
  return `${_round(oLat)},${_round(oLng)}->${_round(dLat)},${_round(dLng)}`;
}

// ── Google Encoded Polyline decoder ───────────────────────────────────────────
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function _decodePolyline(encoded) {
  const result = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result_byte = 0;
    let b;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result_byte |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result_byte & 1 ? ~(result_byte >> 1) : result_byte >> 1;
    lat += dlat;

    shift = 0;
    result_byte = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result_byte |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result_byte & 1 ? ~(result_byte >> 1) : result_byte >> 1;
    lng += dlng;

    result.push([lat / 1e5, lng / 1e5]);
  }

  return result; // [[lat, lng], ...]
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch driving directions between two lat/lng pairs.
 * Results are cached for CACHE_TTL_MS to conserve quota.
 *
 * @returns {{
 *   routePath: number[][],
 *   distanceKm: number,
 *   durationMin: number,
 *   distanceText: string,
 *   durationText: string,
 *   startAddress: string,
 *   endAddress: string,
 * }}
 */
async function getDirections(originLat, originLng, destLat, destLng) {
  const key = _cacheKey(originLat, originLng, destLat, destLng);

  // Return cached entry if still fresh
  const cached = _routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug(`[mapsService] cache hit: ${key}`);
    return cached.data;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured on the server.');
  }

  const url = 'https://maps.googleapis.com/maps/api/directions/json';
  const params = {
    origin:      `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    mode:        'driving',
    key:         apiKey,
  };

  let response;
  try {
    response = await axios.get(url, { params, timeout: 10_000 });
  } catch (err) {
    throw new Error(`Google Directions API request failed: ${err.message}`);
  }

  const { routes, status, error_message } = response.data;

  if (status !== 'OK' || !routes?.length) {
    throw new Error(`Google Directions API error [${status}]: ${error_message || 'No routes returned'}`);
  }

  const route = routes[0];
  const leg   = route.legs[0];

  const data = {
    routePath:    _decodePolyline(route.overview_polyline.points),
    distanceKm:   parseFloat((leg.distance.value / 1000).toFixed(2)),
    durationMin:  Math.round(leg.duration.value / 60),
    distanceText: leg.distance.text,
    durationText: leg.duration.text,
    startAddress: leg.start_address,
    endAddress:   leg.end_address,
  };

  _routeCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  logger.info(`[mapsService] directions fetched: ${key} (${data.distanceKm} km, ${data.durationMin} min)`);
  return data;
}

/** Evict all expired entries (call periodically if memory matters). */
function pruneCache() {
  const now = Date.now();
  for (const [k, v] of _routeCache) {
    if (v.expiresAt < now) _routeCache.delete(k);
  }
}

// Prune every 15 minutes
setInterval(pruneCache, 15 * 60 * 1_000).unref();

module.exports = { getDirections };
