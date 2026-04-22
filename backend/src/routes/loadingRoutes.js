const express = require('express');
const { optimizeLoading } = require('../controllers/loadingController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { optimizeLoadingRules } = require('../validators/loadingValidators');

const router = express.Router();

router.post('/optimize-loading', protect, optimizeLoadingRules, validate, optimizeLoading);

module.exports = router;
