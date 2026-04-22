const { body, param, query } = require('express-validator');

const truckTypes = ['SMALL_VAN', 'CONTAINER_20FT', 'CONTAINER_32FT', 'FLATBED_TRAILER', 'REEFER'];
const trafficConditions = ['LIGHT', 'MODERATE', 'HEAVY', 'SEVERE'];
const weatherConditions = ['CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'FOG', 'SNOW'];
const priorities = ['NORMAL', 'URGENT', 'EXPRESS'];

const predictionTypeParam = [
  body('prediction_type').isIn(['truck', 'delivery', 'delay', 'fuel', 'cluster', 'cargo']),
];

const recommendTruckRules = [
  query('weight_kg').isFloat({ min: 0.1, max: 100000 }),
  query('volume_m3').isFloat({ min: 0.001, max: 1000 }),
  query('distance_km').isFloat({ min: 0.1, max: 20000 }),
  query('cargo_type').optional().isString().trim().notEmpty(),
  query('priority').optional().isIn(priorities),
];

const estimateFuelRules = [
  query('distance_km').isFloat({ min: 0.1, max: 20000 }),
  query('weight_kg').isFloat({ min: 0.1, max: 100000 }),
  query('truck_type').isIn(truckTypes),
];

const shipmentIdParamRules = [
  param('shipmentId').isUUID().withMessage('Valid shipment ID required'),
];

const delayPredictionQueryRules = [
  ...shipmentIdParamRules,
  query('weather').optional().isIn(weatherConditions),
  query('traffic').optional().isIn(trafficConditions),
  query('time_of_day').optional().isString().trim().notEmpty(),
];

const deliveryPredictionQueryRules = [
  ...shipmentIdParamRules,
  query('weather').optional().isIn(weatherConditions),
  query('traffic').optional().isIn(trafficConditions),
];

const clusterShipmentsRules = [
  query('status').optional().isIn(['PENDING', 'OPTIMIZED', 'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
];

const optimizeCargoRules = [
  body('truck_capacity_kg').isFloat({ min: 0.1, max: 100000 }),
  body('truck_capacity_m3').isFloat({ min: 0.001, max: 1000 }),
  body('items').isArray({ min: 1, max: 500 }),
];

module.exports = {
  predictionTypeParam,
  recommendTruckRules,
  estimateFuelRules,
  deliveryPredictionQueryRules,
  delayPredictionQueryRules,
  clusterShipmentsRules,
  optimizeCargoRules,
};
