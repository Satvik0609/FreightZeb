const axios = require('axios');

const ML_API_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

class MLService {
  async predictTruckRecommendation(shipmentData) {
    try {
      const res = await axios.post(`${ML_API_URL}/predict-truck`, shipmentData);
      return res.data;
    } catch (err) {
      console.error('ML truck recommendation failed:', err.message);
      throw new Error('Cannot get truck recommendation');
    }
  }

  async predictDeliveryTime(shipment, route) {
    try {
      const payload = {
        weight: shipment.weight,
        distance_km: route?.distanceKm || 0,
        truck_type: route?.truck?.type,
        origin_pin: shipment.origin.pincode,
        dest_pin: shipment.destination.pincode,
      };

      const res = await axios.post(`${ML_API_URL}/predict-delivery-time`, payload);
      return res.data.predicted_hours;
    } catch (err) {
      console.error('ML delivery time prediction failed');
      return null; 
    }
  }

  async predictDelayRisk(shipmentId) {
  }
}

module.exports = new MLService();