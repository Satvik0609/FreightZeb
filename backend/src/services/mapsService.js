/**
 * mapsService.js
 * Proxy + cache layer for Google Maps Platform APIs.
 * Keeps API keys server-side so they are never exposed to the browser.
 */

const axios = require('axios');
const logger = require('../config/logger');

// ── In-memory route cache ─────────────────────────────────────────────────────
const _routeCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1_000; // 30 min — for static routes
const TRAFFIC_CACHE_TTL = 5 * 60 * 1_000; // 5 min  — for traffic-aware routes

function _round(n) { return Math.round(n * 1_000) / 1_000; }
function _cacheKey(oLat, oLng, dLat, dLng, withTraffic) {
  return `${_round(oLat)},${_round(oLng)}->${_round(dLat)},${_round(dLng)}:${withTraffic ? 'traffic' : 'static'}`;
}

// ── Google Encoded Polyline decoder ───────────────────────────────────────────
function _decodePolyline(encoded) {
  const result = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result_byte = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result_byte |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result_byte & 1 ? ~(result_byte >> 1) : result_byte >> 1;
    shift = 0; result_byte = 0;
    do { b = encoded.charCodeAt(index++) - 63; result_byte |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result_byte & 1 ? ~(result_byte >> 1) : result_byte >> 1;
    result.push([lat / 1e5, lng / 1e5]);
  }
  return result;
}

// ── Core Directions fetcher ───────────────────────────────────────────────────
async function _fetchDirections(originLat, originLng, destLat, destLng, withTraffic = false) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured on the server.');
  }

  const params = {
    origin: `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    mode: 'driving',
    key: apiKey,
    language: 'en',
    units: 'metric',
  };

  // Traffic-aware: use current departure time
  if (withTraffic) {
    params.departure_time = 'now';
    params.traffic_model = 'best_guess';
  }

  let response;
  try {
    response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', { params, timeout: 10_000 });
  } catch (err) {
    throw new Error(`Google Directions API request failed: ${err.message}`);
  }

  const { routes, status, error_message } = response.data;
  if (status !== 'OK' || !routes?.length) {
    throw new Error(`Google Directions API error [${status}]: ${error_message || 'No routes returned'}`);
  }

  const route = routes[0];
  const leg = route.legs[0];

  // ── Traffic delay ─────────────────────────────────────────────────────────
  const durationInTrafficSec = leg.duration_in_traffic?.value ?? null;
  const durationSec = leg.duration.value;
  const trafficDelayMin = durationInTrafficSec !== null
    ? Math.max(0, Math.round((durationInTrafficSec - durationSec) / 60))
    : null;
  const trafficCondition = trafficDelayMin === null ? 'unknown'
    : trafficDelayMin <= 5 ? 'light'
      : trafficDelayMin <= 20 ? 'moderate'
        : trafficDelayMin <= 45 ? 'heavy'
          : 'severe';

  // ── Turn-by-turn steps ────────────────────────────────────────────────────
  const steps = (leg.steps || []).map((s) => ({
    instruction: s.html_instructions.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    distanceText: s.distance?.text,
    durationText: s.duration?.text,
    distanceM: s.distance?.value,
    durationSec: s.duration?.value,
    maneuver: s.maneuver || null,
    startLat: s.start_location?.lat,
    startLng: s.start_location?.lng,
  }));

  // ── Via waypoints (intermediate road names) ───────────────────────────────
  const viaWaypoints = (route.summary || '').split(',').map((s) => s.trim()).filter(Boolean);

  // ── Warnings & tolls ─────────────────────────────────────────────────────
  const warnings = route.warnings || [];
  const hasTolls = (route.legs || []).some((l) =>
    (l.steps || []).some((s) => s.html_instructions?.toLowerCase().includes('toll'))
  );

  return {
    // Core
    routePath: _decodePolyline(route.overview_polyline.points),
    distanceKm: parseFloat((leg.distance.value / 1000).toFixed(2)),
    durationMin: Math.round(durationSec / 60),
    distanceText: leg.distance.text,
    durationText: leg.duration.text,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    // Traffic
    trafficDurationMin: durationInTrafficSec !== null ? Math.round(durationInTrafficSec / 60) : null,
    trafficDelayMin,
    trafficCondition,
    trafficDurationText: leg.duration_in_traffic?.text ?? null,
    // Route details
    summary: route.summary || '',
    viaWaypoints,
    warnings,
    hasTolls,
    copyrights: route.copyrights || '',
    // Steps
    steps,
    stepCount: steps.length,
    // Computed
    avgSpeedKmh: durationSec > 0
      ? parseFloat(((leg.distance.value / 1000) / (durationSec / 3600)).toFixed(1))
      : null,
    fetchedAt: new Date().toISOString(),
    withTraffic,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Basic directions (no traffic) — cached 30 min. */
async function getDirections(originLat, originLng, destLat, destLng) {
  const key = _cacheKey(originLat, originLng, destLat, destLng, false);
  const cached = _routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const data = await _fetchDirections(originLat, originLng, destLat, destLng, false);
  _routeCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  logger.info(`[mapsService] directions: ${key} (${data.distanceKm} km, ${data.durationMin} min)`);
  return data;
}

/** Full route intelligence with live traffic — cached 5 min. */
async function getRouteIntelligence(originLat, originLng, destLat, destLng) {
  const key = _cacheKey(originLat, originLng, destLat, destLng, true);
  const cached = _routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const data = await _fetchDirections(originLat, originLng, destLat, destLng, true);
  _routeCache.set(key, { data, expiresAt: Date.now() + TRAFFIC_CACHE_TTL });
  logger.info(`[mapsService] route-intelligence: ${key} (traffic delay: ${data.trafficDelayMin} min, condition: ${data.trafficCondition})`);
  return data;
}

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of _routeCache) { if (v.expiresAt < now) _routeCache.delete(k); }
}
setInterval(pruneCache, 15 * 60 * 1_000).unref();

module.exports = { getDirections, getRouteIntelligence };
