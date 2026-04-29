const express = require('express');
const router = express.Router();
const {
  getWarehouseAnalytics,
  getWarehouseAnalyticsCharts,
  getDealerAnalytics,
  getDealerAnalyticsCharts,
  getAdminAnalytics,
  getAdminAnalyticsCharts,
} = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/warehouse', restrictTo('WAREHOUSE', 'CARGO_DEALER', 'ADMIN'), getWarehouseAnalytics);
router.get('/warehouse/charts', restrictTo('WAREHOUSE', 'CARGO_DEALER', 'ADMIN'), getWarehouseAnalyticsCharts);
router.get('/dealer', restrictTo('DEALER', 'ADMIN'), getDealerAnalytics);
router.get('/dealer/charts', restrictTo('DEALER', 'ADMIN'), getDealerAnalyticsCharts);
router.get('/admin', restrictTo('ADMIN'), getAdminAnalytics);
router.get('/admin/charts', restrictTo('ADMIN'), getAdminAnalyticsCharts);

module.exports = router;
