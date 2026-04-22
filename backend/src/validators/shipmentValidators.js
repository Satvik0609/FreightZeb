const { body } = require('express-validator');

const createShipmentRules = [
    body('weightKg').isFloat({ min: 0.1 }).withMessage('weightKg must be a positive number'),
    body('volumeM3').optional().isFloat({ min: 0 }),
    body('boxes').optional().isInt({ min: 1 }),
    body('pickupLocation').isObject().withMessage('pickupLocation required'),
    body('pickupLocation.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid pickup latitude'),
    body('pickupLocation.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid pickup longitude'),
    body('pickupLocation.address').notEmpty().withMessage('Pickup address required'),
    body('destination').isObject().withMessage('destination required'),
    body('destination.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid destination latitude'),
    body('destination.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid destination longitude'),
    body('destination.address').notEmpty().withMessage('Destination address required'),
    body('deadline').optional().isISO8601().withMessage('Invalid deadline date'),
];

module.exports = { createShipmentRules };
