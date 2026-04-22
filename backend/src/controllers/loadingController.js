const {
  optimizeTruckLoading,
  validateAndNormalizeLoadingInput,
} = require('../services/loadingService');

async function optimizeLoading(req, res, next) {
  try {
    const input = validateAndNormalizeLoadingInput(req.body);
    const result = await optimizeTruckLoading(input);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = { optimizeLoading };
