const express = require('express');
const router = express.Router();
const { getWarehouseAnalytics, getDealerAnalytics, getAdminAnalytics } = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/warehouse', restrictTo('WAREHOUSE', 'ADMIN'), getWarehouseAnalytics);
router.get('/dealer', restrictTo('DEALER', 'ADMIN'), getDealerAnalytics);
router.get('/admin', restrictTo('ADMIN'), getAdminAnalytics);

module.exports = router;
