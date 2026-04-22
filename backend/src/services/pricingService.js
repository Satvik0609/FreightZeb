/**
 * PRICING SERVICE
 * Calculates freight cost based on distance, weight, truck type, and surcharges.
 * All rates are configurable via ENV or can be stored in DB later.
 */

// Base rate per km by truck type (₹/km)
const BASE_RATE_PER_KM = {
    SMALL_VAN: 12,
    CONTAINER_20FT: 28,
    CONTAINER_32FT: 38,
    FLATBED_TRAILER: 42,
    REEFER: 55,
};

// Weight surcharge: extra ₹ per kg above threshold
const WEIGHT_SURCHARGE_THRESHOLD_KG = 5000;
const WEIGHT_SURCHARGE_PER_KG = 0.8;

// Minimum booking charge (₹)
const MINIMUM_CHARGE = 500;

// Fuel surcharge % (applied on base)
const FUEL_SURCHARGE_PCT = 0.08; // 8%

// GST %
const GST_PCT = 0.18; // 18%

/**
 * Calculate full pricing breakdown for a shipment + truck combination.
 * @param {number} distanceKm
 * @param {number} weightKg
 * @param {string} truckType
 * @param {number|null} dealerPricePerKm  — dealer's custom rate (overrides base if set)
 * @returns {object} pricing breakdown
 */
function calculate({ distanceKm, weightKg, truckType, dealerPricePerKm = null }) {
    const ratePerKm = dealerPricePerKm || BASE_RATE_PER_KM[truckType] || 30;

    const baseCharge = Math.max(ratePerKm * distanceKm, MINIMUM_CHARGE);
    const weightExtra = weightKg > WEIGHT_SURCHARGE_THRESHOLD_KG
        ? (weightKg - WEIGHT_SURCHARGE_THRESHOLD_KG) * WEIGHT_SURCHARGE_PER_KG
        : 0;
    const fuelSurcharge = parseFloat((baseCharge * FUEL_SURCHARGE_PCT).toFixed(2));
    const subtotal = parseFloat((baseCharge + weightExtra + fuelSurcharge).toFixed(2));
    const gst = parseFloat((subtotal * GST_PCT).toFixed(2));
    const total = parseFloat((subtotal + gst).toFixed(2));

    return {
        ratePerKm,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        baseCharge: parseFloat(baseCharge.toFixed(2)),
        weightSurcharge: parseFloat(weightExtra.toFixed(2)),
        fuelSurcharge,
        subtotal,
        gst,
        total,
        currency: 'INR',
    };
}

module.exports = { calculate };
