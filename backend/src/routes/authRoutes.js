const express = require('express');
const router = express.Router();
const {
    register, login, getMe, updateMe,
    changePassword, forgotPassword, resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, resetPasswordLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
    registerRules,
    loginRules,
    forgotPasswordRules,
    resetPasswordRules,
    updateMeRules,
    changePasswordRules,
} = require('../validators/authValidators');

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/forgot-password', authLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPasswordRules, validate, resetPassword);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMeRules, validate, updateMe);
router.patch('/me/password', protect, changePasswordRules, validate, changePassword);

module.exports = router;
