/**
 * services/mlService.js
 * HTTP client for the Python FastAPI ML microservice.
 *
 * Improvements:
 *  - Simple circuit-breaker (opens after 5 consecutive failures, half-opens after 30s)
 *  - Request-ID propagation
 *  - Validated fallback responses typed to match ML service shape
 *  - No silent swallowing of errors — always logs
 */

const axios = require('axios');
const logger = require('../config/logger');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_API_KEY = process.env.ML_SERVICE_API_KEY || 'dev-ml-service-key';
const TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 10_000;

// ── CO₂ / fuel rates (keep in sync with pricingService.js) ───────────────────
const CO2_RATES = {
  SMALL_VAN: 0.18,
  CONTAINER_20FT: 0.55,
  CONTAINER_32FT: 0.72,
  FLATBED_TRAILER: 0.80,
  REEFER: 0.90,
};

const FUEL_RATES = {
  SMALL_VAN: 0.12,
  CONTAINER_20FT: 0.28,
  CONTAINER_32FT: 0.35,
  FLATBED_TRAILER: 0.38,
  REEFER: 0.40,
};

// ── Simple circuit breaker ────────────────────────────────────────────────────
const CIRCUIT = {
  failures: 0,
  threshold: 5,
  openedAt: null,
  halfOpenMs: 30_000,
};

function isCircuitOpen() {
  if (!CIRCUIT.openedAt) return false;
  if (Date.now() - CIRCUIT.openedAt > CIRCUIT.halfOpenMs) {
    CIRCUIT.openedAt = null;
    CIRCUIT.failures = 0;
    return false;
  }
  return true;
}

function recordSuccess() {
  CIRCUIT.failures = 0;
  CIRCUIT.openedAt = null;
}

function recordFailure() {
  CIRCUIT.failures++;
  if (CIRCUIT.failures >= CIRCUIT.threshold && !CIRCUIT.openedAt) {
    CIRCUIT.openedAt = Date.now();
    logger.error(`ML circuit breaker OPEN after ${CIRCUIT.failures} consecutive failures`);
  }
}

// ── Axios helpers ─────────────────────────────────────────────────────────────
async function _post(endpoint, body, requestId, timeoutMs = TIMEOUT_MS) {
  if (isCircuitOpen()) throw new Error('ML circuit breaker is open — skipping call');

  try {
    const res = await axios.post(`${ML_URL}${endpoint}`, body, {
      timeout: timeoutMs,
      headers: {
        'X-ML-API-Key': ML_API_KEY,
        'X-Request-ID': requestId || '',
        'Content-Type': 'application/json',
      },
    });
    recordSuccess();
    return res.data;
  } catch (err) {
    recordFailure();
    throw err;
  }
}

async function _get(endpoint, requestId, timeoutMs = 5_000) {
  if (isCircuitOpen()) throw new Error('ML circuit breaker is open');

  try {
    const res = await axios.get(`${ML_URL}${endpoint}`, {
      timeout: timeoutMs,
      headers: { 'X-ML-API-Key': ML_API_KEY, 'X-Request-ID': requestId || '' },
    });
    recordSuccess();
    return res.data;
  } catch (err) {
    recordFailure();
    throw err;
  }
}

// ── Fallback builders ─────────────────────────────────────────────────────────
function _truckFallback(data) {
  let recommended = 'CONTAINER_20FT';
  if ((data.weight_kg || 0) > 20_000 || (data.volume_m3 ?? Infinity) > 60) recommended = 'CONTAINER_32FT';
  else if ((data.weight_kg || 0) < 2_000 && (data.volume_m3 ?? Infinity) < 10) recommended = 'SMALL_VAN';
  else if (data.cargo_type === 'REFRIGERATED' || data.cargo_type === 'PERISHABLE') recommended = 'REEFER';
  return { recommended_truck: recommended, confidence: 0.55, fallback: true, source: 'heuristic' };
}

function _deliveryFallback(data) {
  const hours = parseFloat(((data.distance_km || 0) / 60).toFixed(2));
  return { predicted_hours: hours, confidence: 0.45, fallback: true, source: 'heuristic' };
}

function _fuelFallback(data) {
  const rate = FUEL_RATES[data.truck_type] || 0.30;
  const liters = parseFloat(((data.distance_km || 0) * rate).toFixed(2));
  const costInr = parseFloat((liters * 90).toFixed(2));
  const co2Kg = parseFloat(((data.distance_km || 0) * (CO2_RATES[data.truck_type] || 0.60)).toFixed(2));
  return {
    estimated_liters: liters,
    estimated_cost_inr: costInr,
    estimated_cost: costInr,
    co2_kg: co2Kg,
    co2_emissions_kg: co2Kg,
    fuel_price_per_liter_inr: 90,
    fallback: true,
    source: 'heuristic',
  };
}

function _clusterFallback(shipments) {
  return {
    n_clusters: 1,
    clusters: [{ cluster_id: 0, shipments }],
    total_shipments: shipments.length,
    fallback: true,
    source: 'heuristic',
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────
class MLService {
  /** Unified dispatcher — mirrors the FastAPI /predict endpoint. */
  async predictAll(predictionType, payload, requestId) {
    try {
      const data = await _post('/predict', { prediction_type: predictionType, ...payload }, requestId);
      return { ...data, fallback: false, source: 'ml_service' };
    } catch (err) {
      logger.warn(`ML /predict failed [${predictionType}] — using fallback. Reason: ${err.message}`);
      return this._fallbackByType(predictionType, payload);
    }
  }

  _fallbackByType(type, payload) {
    switch (type) {
      case 'truck': return _truckFallback(payload);
      case 'delivery': return _deliveryFallback(payload);
      case 'fuel': return _fuelFallback(payload);
      case 'delay': throw new Error('Delay prediction requires the ML service — no offline fallback available');
      case 'cluster': return _clusterFallback(payload.shipments || []);
      default:
        throw new Error(`No fallback for prediction_type: ${type}`);
    }
  }

  async predictTruckRecommendation(data, requestId) {
    try {
      const res = await _post('/predict-truck', data, requestId);
      return { ...res, fallback: false };
    } catch (err) {
      logger.warn(`ML truck recommendation failed: ${err.message}`);
      return _truckFallback(data);
    }
  }

  async predictDeliveryTime(data, requestId) {
    try {
      const res = await _post('/predict-delivery-time', data, requestId);
      return { ...res, fallback: false };
    } catch (err) {
      logger.warn(`ML delivery prediction failed: ${err.message}`);
      return _deliveryFallback(data);
    }
  }

  async clusterShipments(shipments, requestId) {
    try {
      const res = await _post('/cluster-shipments', { shipments }, requestId, 15_000);
      return { ...res, fallback: false };
    } catch (err) {
      logger.warn(`ML clustering failed: ${err.message}`);
      return _clusterFallback(shipments);
    }
  }

  async predictDelayRisk(data, requestId) {
    const res = await _post('/predict-delay-risk', data, requestId);
    return { ...res, fallback: false };
  }

  async estimateFuel(data, requestId) {
    try {
      const res = await _post('/estimate-fuel', data, requestId);
      return { ...res, fallback: false };
    } catch (err) {
      logger.warn(`ML fuel estimation failed: ${err.message}`);
      return _fuelFallback(data);
    }
  }

  async optimizeCargo(data, requestId) {
    // No fallback for cargo optimization — it's a hard computational requirement.
    // Callers should catch and return 503 if ML is down.
    const res = await _post('/optimize-cargo', data, requestId, 15_000);
    return { ...res, fallback: false };
  }

  /** Pure math — no ML call needed. */
  estimateCo2(distanceKm, truckType) {
    const rate = CO2_RATES[truckType] || 0.60;
    return parseFloat((distanceKm * rate).toFixed(2));
  }

  async getHealth(requestId) { return _get('/health', requestId, 5_000); }
  async getReadyz(requestId) { return _get('/readyz', requestId, 5_000); }
  async getModelsInfo(requestId) { return _get('/models/info', requestId, 5_000); }

  getCircuitStatus() {
    return {
      open: isCircuitOpen(),
      failures: CIRCUIT.failures,
      openedAt: CIRCUIT.openedAt,
    };
  }
}

module.exports = new MLService();
