const express = require('express');
const { getShipmentConsolidation } = require('../controllers/consolidationController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { consolidateShipmentsRules } = require('../validators/consolidationValidators');

const router = express.Router();

router.get('/consolidate', protect, consolidateShipmentsRules, validate, getShipmentConsolidation);

module.exports = router;
