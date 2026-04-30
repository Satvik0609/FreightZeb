const express = require('express');
const router = express.Router();
const {
    createShipment, getMyShipments, getAvailableShipments, getAllShipments,
    getShipment, cancelShipment, runOptimization,
} = require('../controllers/shipmentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { createShipmentRules } = require('../validators/shipmentValidators');

router.use(protect);

// Named paths before /:id
router.post('/', restrictTo('WAREHOUSE', 'ADMIN'), createShipmentRules, validate, createShipment);
router.get('/my', restrictTo('WAREHOUSE'), getMyShipments);
router.get('/available', restrictTo('DEALER', 'CARGO_DEALER'), getAvailableShipments);
router.get('/', restrictTo('ADMIN'), getAllShipments);

// Parameterised
router.get('/:id', getShipment);
router.patch('/:id/cancel', cancelShipment);
router.post('/:id/optimize', restrictTo('WAREHOUSE', 'ADMIN'), runOptimization);

module.exports = router;
