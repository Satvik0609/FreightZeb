const express = require('express');
const router = express.Router();
const { getAnalytics, getShipmentTrends } = require('../controllers/analyticsController');

router.get('/', getAnalytics);
router.get('/trends', getShipmentTrends);

module.exports = router;
