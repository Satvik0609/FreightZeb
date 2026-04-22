const { body, param } = require('express-validator');

const pushLocationRules = [
    body('bookingId').isUUID().withMessage('Valid bookingId required'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('status').optional().trim().isLength({ max: 100 }),
];

const bookingIdParam = [
    param('bookingId').isUUID().withMessage('Valid bookingId required'),
];

module.exports = { pushLocationRules, bookingIdParam };
