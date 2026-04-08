const express = require('express');
const router = express.Router();
const {
  getTruckRecommendation,
  predictDeliveryTime,
  clusterShipments,
  predictDelayRisk,
  estimateFuel,
  optimizeCargo
} = require('../controllers/mlController');

router.get('/recommend-truck', getTruckRecommendation);
router.get('/predict-delivery/:shipmentId', predictDeliveryTime);
router.get('/cluster-shipments', clusterShipments);
router.get('/predict-delay/:shipmentId', predictDelayRisk);
router.get('/estimate-fuel', estimateFuel);
router.post('/optimize-cargo', optimizeCargo);

module.exports = router;
