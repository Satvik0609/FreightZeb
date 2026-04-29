/**
 * mapsRoutes.js
 * Backend proxy for Google Maps Platform APIs.
 * API keys stay server-side — clients never see them.
 */

const express     = require('express');
const { protect } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../helpers/errors');
const { getDirections }  = require('../services/mapsService');

const router = express.Router();

router.use(protect);

/**
 * GET /api/maps/directions
 * Query params: originLat, originLng, destLat, destLng  (all required, floats)
 *
 * Response:
 *   { success, routePath: [[lat,lng],...], distanceKm, durationMin,
 *     distanceText, durationText, startAddress, endAddress }
 */
router.get(
  '/directions',
  asyncHandler(async (req, res) => {
    const { originLat, originLng, destLat, destLng } = req.query;
    const [oLat, oLng, dLat, dLng] = [originLat, originLng, destLat, destLng].map(Number);

    if ([oLat, oLng, dLat, dLng].some((v) => !Number.isFinite(v))) {
      return res.status(400).json({
        success: false,
        message: 'originLat, originLng, destLat, destLng must all be numeric.',
      });
    }

    try {
      const result = await getDirections(oLat, oLng, dLat, dLng);
      return res.json({ success: true, ...result });
    } catch (err) {
      const isConfig = err.message?.includes('not configured');
      return res.status(isConfig ? 503 : 502).json({
        success: false,
        message: err.message,
        code: isConfig ? 'MAPS_KEY_MISSING' : 'MAPS_API_ERROR',
      });
    }
  }),
);

module.exports = router;
