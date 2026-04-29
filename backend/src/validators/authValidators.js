const { body } = require('express-validator');

const registerRules = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('role').optional().isIn(['WAREHOUSE', 'DEALER', 'CARGO_DEALER']).withMessage('Invalid role'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('company').optional().trim(),
];

const loginRules = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
];

const forgotPasswordRules = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

const resetPasswordRules = [
    body('token').isString().trim().notEmpty().withMessage('Reset token required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const updateMeRules = [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('company').optional().trim(),
];

const changePasswordRules = [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

module.exports = {
    registerRules,
    loginRules,
    forgotPasswordRules,
    resetPasswordRules,
    updateMeRules,
    changePasswordRules,
};
