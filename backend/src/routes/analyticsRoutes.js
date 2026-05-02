const express = require('express');
const router = express.Router();
const { getWarehouseAnalytics, getDealerAnalytics, getDealerEarnings, getAdminEarnings, getAdminAnalytics } = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/warehouse', restrictTo('WAREHOUSE', 'ADMIN'), getWarehouseAnalytics);
router.get('/dealer', restrictTo('DEALER', 'ADMIN'), getDealerAnalytics);
router.get('/dealer/earnings', restrictTo('DEALER', 'ADMIN'), getDealerEarnings);
router.get('/admin/earnings', restrictTo('ADMIN'), getAdminEarnings);
router.get('/admin', restrictTo('ADMIN'), getAdminAnalytics);

module.exports = router;
