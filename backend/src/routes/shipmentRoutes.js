const express = require('express');
const router = express.Router();
const {
    createShipment, getMyShipments, getAllShipments, getAvailableShipments,
    getShipment, cancelShipment, runOptimization,
} = require('../controllers/shipmentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { createShipmentRules } = require('../validators/shipmentValidators');

router.use(protect);

// Named paths before /:id
router.post('/', restrictTo('WAREHOUSE', 'CARGO_DEALER', 'ADMIN'), createShipmentRules, validate, createShipment);
router.get('/my', restrictTo('WAREHOUSE', 'CARGO_DEALER'), getMyShipments);
router.get('/available', getAvailableShipments);   // DEALER sees all bookable shipments
router.get('/', restrictTo('ADMIN'), getAllShipments);

// Parameterised
router.get('/:id', getShipment);
router.patch('/:id/cancel', cancelShipment);
router.post('/:id/optimize', restrictTo('WAREHOUSE', 'CARGO_DEALER', 'ADMIN'), runOptimization);

module.exports = router;
