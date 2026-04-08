const axios = require('axios');
const logger = require('../config/logger');

const ML_API_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

class MLService {
  async predictTruckRecommendation(shipmentData) {
    try {
      const res = await axios.post(`${ML_API_URL}/predict-truck`, shipmentData, {
        timeout: 10000
      });
      logger.info(`Truck recommendation: ${res.data.recommended_truck}`);
      return res.data;
    } catch (err) {
      logger.error('ML truck recommendation failed:', err.message);
      throw new Error('Cannot get truck recommendation from ML service');
    }
  }

  async predictDeliveryTime(shipment, route) {
    try {
      const payload = {
        weight_kg: shipment.weightKg,
        distance_km: route?.distanceKm || 0,
        truck_type: route?.truck?.type || 'CONTAINER_20FT',
        traffic_condition: 'MODERATE',
        weather_condition: 'CLEAR'
      };

      const res = await axios.post(`${ML_API_URL}/predict-delivery-time`, payload, {
        timeout: 10000
      });
      logger.info(`Delivery prediction: ${res.data.predicted_hours} hours`);
      return res.data;
    } catch (err) {
      logger.error('ML delivery time prediction failed:', err.message);
      throw new Error('Cannot get delivery time prediction');
    }
  }

  async clusterShipments(shipments) {
    try {
      const res = await axios.post(`${ML_API_URL}/cluster-shipments`, {
        shipments
      }, {
        timeout: 15000
      });
      logger.info(`Clustered ${shipments.length} shipments into ${res.data.num_clusters} groups`);
      return res.data;
    } catch (err) {
      logger.error('Shipment clustering failed:', err.message);
      throw new Error('Cannot cluster shipments');
    }
  }

  async predictDelayRisk(data) {
    try {
      const res = await axios.post(`${ML_API_URL}/predict-delay-risk`, data, {
        timeout: 10000
      });
      logger.info(`Delay risk: ${res.data.risk_level}`);
      return res.data;
    } catch (err) {
      logger.error('Delay prediction failed:', err.message);
      throw new Error('Cannot predict delay risk');
    }
  }

  async estimateFuel(data) {
    try {
      const res = await axios.post(`${ML_API_URL}/estimate-fuel`, data, {
        timeout: 10000
      });
      logger.info(`Fuel estimate: ${res.data.estimated_liters} liters`);
      return res.data;
    } catch (err) {
      logger.error('Fuel estimation failed:', err.message);
      throw new Error('Cannot estimate fuel consumption');
    }
  }

  async optimizeCargo(data) {
    try {
      const res = await axios.post(`${ML_API_URL}/optimize-cargo`, data, {
        timeout: 15000
      });
      logger.info(`Cargo optimization: ${res.data.utilization_percent}% utilization`);
      return res.data;
    } catch (err) {
      logger.error('Cargo optimization failed:', err.message);
      throw new Error('Cannot optimize cargo loading');
    }
  }
}

module.exports = new MLService();