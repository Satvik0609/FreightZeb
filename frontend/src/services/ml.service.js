import api from './api'

export const mlService = {
  health: () => api.get('/ml/health'),
  modelsInfo: () => api.get('/ml/models/info'),
  predict: (data) => api.post('/ml/predict', data),
  recommendTruck: (params) => api.get('/ml/recommend-truck', { params }),
  predictDelivery: (shipmentId, params) =>
    api.get(`/ml/predict-delivery/${shipmentId}`, { params }),
  predictDelay: (shipmentId, params) =>
    api.get(`/ml/predict-delay/${shipmentId}`, { params }),
  estimateFuel: (params) => api.get('/ml/estimate-fuel', { params }),
  clusterShipments: (status = 'PENDING') =>
    api.get('/ml/cluster-shipments', { params: { status } }),
  optimizeCargo: (data) => api.post('/ml/optimize-cargo', data),
  predictBooking: (bookingId) => api.post(`/ml/predict-booking/${bookingId}`),
  predictBookingsBatch: (bookingIds) => api.post('/ml/predict-bookings/batch', { bookingIds }),
}
