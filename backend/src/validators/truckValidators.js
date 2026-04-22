const { body, param } = require('express-validator');

const createTruckRules = [
    body('registrationNo').trim().notEmpty().withMessage('Registration number required'),
    body('truckType')
        .isIn(['SMALL_VAN', 'CONTAINER_20FT', 'CONTAINER_32FT', 'FLATBED_TRAILER', 'REEFER'])
        .withMessage('Invalid truck type'),
    body('capacityKg').isFloat({ min: 1 }).withMessage('capacityKg must be positive'),
    body('capacityM3').optional().isFloat({ min: 0 }),
    body('routeFrom').trim().notEmpty().withMessage('routeFrom required'),
    body('routeTo').trim().notEmpty().withMessage('routeTo required'),
    body('pricePerKm').optional().isFloat({ min: 0 }),
];

const locationRules = [
    param('id').isUUID().withMessage('Invalid truck ID'),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
];

const bookingRules = [
    body('shipmentId').isUUID().withMessage('Valid shipmentId required'),
    body('truckId').isUUID().withMessage('Valid truckId required'),
];

module.exports = { createTruckRules, locationRules, bookingRules };
