const express = require('express');
const router = express.Router();
const { getTrackingHistory, getLatestLocation, pushLocation } = require('../controllers/trackingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { pushLocationRules, bookingIdParam } = require('../validators/trackingValidators');

router.use(protect);

// POST must come before /:bookingId to avoid route shadowing
router.post('/update', restrictTo('DEALER', 'ADMIN'), pushLocationRules, validate, pushLocation);

router.get('/:bookingId', bookingIdParam, validate, getTrackingHistory);
router.get('/:bookingId/latest', bookingIdParam, validate, getLatestLocation);

module.exports = router;
