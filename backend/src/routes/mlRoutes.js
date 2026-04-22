/**
 * ML ROUTES — /api/ml
 * All routes require authentication.
 * Protected by the existing `protect` middleware.
 */

const express = require('express');
const router = express.Router();

const {
  predictAll,
  getTruckRecommendation,
  predictDeliveryTime,
  clusterShipments,
  predictDelayRisk,
  estimateFuel,
  optimizeCargo,
  getMlHealth,
  getModelsInfo,
} = require('../controllers/mlController');

const { protect } = require('../middleware/authMiddleware');
const { mlLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  predictionTypeParam,
  recommendTruckRules,
  estimateFuelRules,
  deliveryPredictionQueryRules,
  delayPredictionQueryRules,
  clusterShipmentsRules,
  optimizeCargoRules,
} = require('../validators/mlValidators');

// ── Public ML health endpoints (no auth needed) ───────────────────────────────
router.get('/health', getMlHealth);
router.get('/models/info', getModelsInfo);

// ── All prediction routes require auth ────────────────────────────────────────
router.use(protect);
router.use(mlLimiter);

// Unified prediction entry point
// POST /api/ml/predict
// Body: { prediction_type: "truck"|"delivery"|"delay"|"fuel"|"cluster"|"cargo", ...fields }
router.post('/predict', predictionTypeParam, validate, predictAll);

// Individual prediction endpoints
// GET  /api/ml/recommend-truck?weight_kg=&volume_m3=&distance_km=&cargo_type=&priority=
router.get('/recommend-truck', recommendTruckRules, validate, getTruckRecommendation);

// GET  /api/ml/predict-delivery/:shipmentId?traffic=&weather=
router.get('/predict-delivery/:shipmentId', deliveryPredictionQueryRules, validate, predictDeliveryTime);

// GET  /api/ml/cluster-shipments?status=PENDING
router.get('/cluster-shipments', clusterShipmentsRules, validate, clusterShipments);

// GET  /api/ml/predict-delay/:shipmentId?weather=&traffic=&time_of_day=
router.get('/predict-delay/:shipmentId', delayPredictionQueryRules, validate, predictDelayRisk);

// GET  /api/ml/estimate-fuel?distance_km=&weight_kg=&truck_type=
router.get('/estimate-fuel', estimateFuelRules, validate, estimateFuel);

// POST /api/ml/optimize-cargo
// Body: { truck_capacity_kg, truck_capacity_m3, items: [...] }
router.post('/optimize-cargo', optimizeCargoRules, validate, optimizeCargo);

module.exports = router;
