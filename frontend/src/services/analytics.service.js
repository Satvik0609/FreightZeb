import api from './api'

export const analyticsService = {
  getWarehouse: () => api.get('/analytics/warehouse'),
  getDealer: () => api.get('/analytics/dealer'),
  getAdmin: () => api.get('/analytics/admin'),
}
