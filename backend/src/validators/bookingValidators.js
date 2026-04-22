const { body, param } = require('express-validator');

const createBookingRules = [
    body('shipmentId').isUUID().withMessage('Valid shipmentId (UUID) required'),
    body('truckId').isUUID().withMessage('Valid truckId (UUID) required'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes max 500 chars'),
    body('optimScore').optional().isFloat({ min: 0, max: 1 }).withMessage('optimScore must be 0–1'),
];

const updateStatusRules = [
    param('id').isUUID().withMessage('Valid booking ID required'),
    body('status')
        .isIn(['APPROVED', 'REJECTED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
        .withMessage('Invalid status'),
    body('notes').optional().trim().isLength({ max: 500 }),
];

module.exports = { createBookingRules, updateStatusRules };
