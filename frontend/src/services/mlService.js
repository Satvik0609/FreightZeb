import { get, post } from "./http";

export const mlService = {
  health: async () => get("/ml/health"),
  modelsInfo: async () => get("/ml/models/info"),
  predict: async (payload) => post("/ml/predict", payload),
  recommendTruck: async (params) => get("/ml/recommend-truck", { params }),
  predictDelivery: async (shipmentId, params) => get(`/ml/predict-delivery/${shipmentId}`, { params }),
  predictDelay: async (shipmentId, params) => get(`/ml/predict-delay/${shipmentId}`, { params }),
  estimateFuel: async (params) => get("/ml/estimate-fuel", { params }),
  optimizeCargo: async (payload) => post("/ml/optimize-cargo", payload),
};
