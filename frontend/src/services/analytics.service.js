import api from './api'

export const analyticsService = {
  getWarehouse: () => api.get('/analytics/warehouse'),
  getDealer: () => api.get('/analytics/dealer'),
  getDealerEarnings: () => api.get('/analytics/dealer/earnings'),
  getAdminEarnings: () => api.get('/analytics/admin/earnings'),
  getAdmin: () => api.get('/analytics/admin'),
}
