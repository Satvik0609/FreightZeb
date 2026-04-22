const { consolidateShipments } = require('../services/consolidationService');

async function getShipmentConsolidation(req, res, next) {
  try {
    const result = await consolidateShipments();
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = { getShipmentConsolidation };
