const { body } = require('express-validator');

const optimizeLoadingRules = [
  body('truck').isObject().withMessage('truck is required'),
  body('truck.length').isFloat({ min: 0.0001 }).withMessage('truck.length must be a positive number'),
  body('truck.width').isFloat({ min: 0.0001 }).withMessage('truck.width must be a positive number'),
  body('truck.height').isFloat({ min: 0.0001 }).withMessage('truck.height must be a positive number'),
  body('truck.maxWeight').isFloat({ min: 0.1, max: 100000 }).withMessage('truck.maxWeight must be a positive number'),
  body('shipmentIds').isArray({ min: 1, max: 100 }).withMessage('shipmentIds must be a non-empty array'),
  body('shipmentIds.*').isUUID().withMessage('shipmentIds must contain valid UUID values'),
];

module.exports = { optimizeLoadingRules };
