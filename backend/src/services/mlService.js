/**
 * services/mlService.js
 * HTTP client for the Python FastAPI ML microservice.
 */

const axios = require('axios');
const logger = require('../config/logger');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_API_KEY = process.env.ML_SERVICE_API_KEY || 'dev-ml-service-key';
const TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 10_000;

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

const CIRCUIT = {
  failures: 0,
  threshold: 5,
  openedAt: null,
  halfOpenMs: 30_000,
};

const TELEMETRY = {
  startedAt: Date.now(),
  requests: 0,
  successes: 0,
  fallbacks: 0,
  byType: {
    truck: { requests: 0, fallbacks: 0 },
    delivery: { requests: 0, fallbacks: 0 },
    delay: { requests: 0, fallbacks: 0 },
    fuel: { requests: 0, fallbacks: 0 },
    cluster: { requests: 0, fallbacks: 0 },
    cargo: { requests: 0, fallbacks: 0 },
  },
  lastFallbackAt: null,
  lastFallbackReason: null,
  retrain: {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastStatus: 'never',
    lastResultSummary: null,
  },
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

async function _post(endpoint, body, requestId, timeoutMs = TIMEOUT_MS) {
  if (isCircuitOpen()) throw new Error('ML circuit breaker is open - skipping call');

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

function shouldUseFallback(err) {
  if (!err) return true;
  if (!err.response) return true;

  const status = err.response.status;
  return status >= 500 || status === 503 || status === 504;
}

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
  return {
    estimated_liters: liters,
    estimated_cost: parseFloat((liters * 90).toFixed(2)),
    co2_kg: parseFloat(((data.distance_km || 0) * (CO2_RATES[data.truck_type] || 0.60)).toFixed(2)),
    co2_emissions_kg: parseFloat(((data.distance_km || 0) * (CO2_RATES[data.truck_type] || 0.60)).toFixed(2)),
    fallback: true,
    source: 'heuristic',
  };
}

function _delayFallback(data) {
  const wRisk = { CLEAR: 0, CLOUDY: 10, RAIN: 25, STORM: 50, FOG: 35, SNOW: 45 };
  const tRisk = { LIGHT: 0, MODERATE: 15, HEAVY: 35, SEVERE: 50 };
  const prob = Math.min((wRisk[data.weather_condition] || 10) + (tRisk[data.traffic_condition] || 15), 95);
  const level = prob < 20 ? 'LOW' : prob < 45 ? 'MODERATE' : prob < 70 ? 'HIGH' : 'CRITICAL';
  return { risk_level: level, delay_probability: prob, confidence: 0.50, fallback: true, source: 'heuristic' };
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

class MLService {
  _markRequest(type) {
    TELEMETRY.requests += 1;
    if (type && TELEMETRY.byType[type]) TELEMETRY.byType[type].requests += 1;
  }

  _markSuccess() {
    TELEMETRY.successes += 1;
  }

  _markFallback(type, reason) {
    TELEMETRY.fallbacks += 1;
    TELEMETRY.lastFallbackAt = Date.now();
    TELEMETRY.lastFallbackReason = reason || 'unknown';
    if (type && TELEMETRY.byType[type]) TELEMETRY.byType[type].fallbacks += 1;
  }

  async predictAll(predictionType, payload, requestId) {
    this._markRequest(predictionType);
    try {
      const data = await _post('/predict', { prediction_type: predictionType, ...payload }, requestId);
      this._markSuccess();
      return { ...data, fallback: false, source: 'ml_service' };
    } catch (err) {
      if (!shouldUseFallback(err)) throw err;

      logger.warn(`ML /predict failed [${predictionType}] - using fallback. Reason: ${err.message}`);
      if (predictionType === 'cargo') {
        throw new Error('Cargo optimization requires the ML service to be available.');
      }

      this._markFallback(predictionType, err.message);
      return this._fallbackByType(predictionType, payload);
    }
  }

  _fallbackByType(type, payload) {
    switch (type) {
      case 'truck': return _truckFallback(payload);
      case 'delivery': return _deliveryFallback(payload);
      case 'fuel': return _fuelFallback(payload);
      case 'delay': return _delayFallback(payload);
      case 'cluster': return _clusterFallback(payload.shipments || []);
      default:
        throw new Error(`No fallback for prediction_type: ${type}`);
    }
  }

  async predictTruckRecommendation(data, requestId) {
    this._markRequest('truck');
    try {
      const res = await _post('/predict-truck', data, requestId);
      this._markSuccess();
      return { ...res, fallback: false };
    } catch (err) {
      if (!shouldUseFallback(err)) throw err;
      logger.warn(`ML truck recommendation failed: ${err.message}`);
      this._markFallback('truck', err.message);
      return _truckFallback(data);
    }
  }

  async predictDeliveryTime(data, requestId) {
    this._markRequest('delivery');
    try {
      const res = await _post('/predict-delivery-time', data, requestId);
      this._markSuccess();
      return { ...res, fallback: false };
    } catch (err) {
      if (!shouldUseFallback(err)) throw err;
      logger.warn(`ML delivery prediction failed: ${err.message}`);
      this._markFallback('delivery', err.message);
      return _deliveryFallback(data);
    }
  }

  async clusterShipments(shipments, requestId) {
    this._markRequest('cluster');
    try {
      const res = await _post('/cluster-shipments', { shipments }, requestId, 15_000);
      this._markSuccess();
      return { ...res, fallback: false };
    } catch (err) {
      if (!shouldUseFallback(err)) throw err;
      logger.warn(`ML clustering failed: ${err.message}`);
      this._markFallback('cluster', err.message);
      return _clusterFallback(shipments);
    }
  }

  async predictDelayRisk(data, requestId) {
    this._markRequest('delay');
    try {
      const res = await _post('/predict-delay-risk', data, requestId);
      this._markSuccess();
      return { ...res, fallback: false };
    } catch (err) {
      if (!shouldUseFallback(err)) throw err;
      logger.warn(`ML delay risk failed: ${err.message}`);
      this._markFallback('delay', err.message);
      return _delayFallback(data);
    }
  }

  async estimateFuel(data, requestId) {
    this._markRequest('fuel');
    try {
      const res = await _post('/estimate-fuel', data, requestId);
      this._markSuccess();
      return { ...res, fallback: false };
    } catch (err) {
      if (!shouldUseFallback(err)) throw err;
      logger.warn(`ML fuel estimation failed: ${err.message}`);
      this._markFallback('fuel', err.message);
      return _fuelFallback(data);
    }
  }

  async optimizeCargo(data, requestId) {
    this._markRequest('cargo');
    const res = await _post('/optimize-cargo', data, requestId, 15_000);
    this._markSuccess();
    return { ...res, fallback: false };
  }

  estimateCo2(distanceKm, truckType) {
    const rate = CO2_RATES[truckType] || 0.60;
    return parseFloat((distanceKm * rate).toFixed(2));
  }

  async triggerRetrain(requestId, backendUrl, authHeader) {
    TELEMETRY.retrain.lastAttemptAt = Date.now();
    // Bypass circuit breaker — this is an admin action, not a prediction
    try {
      const res = await axios.post(`${ML_URL}/retrain`, {
        backend_url: backendUrl || process.env.BACKEND_URL || 'http://localhost:5000',
        auth_header: authHeader || '',
      }, {
        timeout: 120_000,
        headers: {
          'X-ML-API-Key': ML_API_KEY,
          'X-Request-ID': requestId || '',
          'Content-Type': 'application/json',
        },
      });
      recordSuccess(); // reset circuit on success
      TELEMETRY.retrain.lastSuccessAt = Date.now();
      TELEMETRY.retrain.lastStatus = 'success';
      TELEMETRY.retrain.lastResultSummary = {
        results: res.data?.results || null,
        dataCounts: res.data?.data_counts || null,
      };
      return res.data;
    } catch (err) {
      TELEMETRY.retrain.lastStatus = 'failed';
      TELEMETRY.retrain.lastResultSummary = { error: err.message };
      throw err;
    }
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

  getTelemetry() {
    const fallbackRate = TELEMETRY.requests > 0
      ? Number(((TELEMETRY.fallbacks / TELEMETRY.requests) * 100).toFixed(2))
      : 0;
    return {
      uptimeSeconds: Math.floor((Date.now() - TELEMETRY.startedAt) / 1000),
      requests: TELEMETRY.requests,
      successes: TELEMETRY.successes,
      fallbacks: TELEMETRY.fallbacks,
      fallbackRatePercent: fallbackRate,
      degraded: fallbackRate >= Number(process.env.ML_DEGRADED_FALLBACK_RATE_PERCENT || 25),
      byType: TELEMETRY.byType,
      lastFallbackAt: TELEMETRY.lastFallbackAt,
      lastFallbackReason: TELEMETRY.lastFallbackReason,
      retrain: TELEMETRY.retrain,
    };
  }
}

module.exports = new MLService();
