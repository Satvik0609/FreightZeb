import api from './api'

export const shipmentsService = {
  create: (data) => api.post('/shipments', data),
  getMy: () => api.get('/shipments/my'),
  getAvailable: (params) => api.get('/shipments/available', { params }),
  getAll: () => api.get('/shipments'),
  getById: (id) => api.get(`/shipments/${id}`),
  cancel: (id) => api.patch(`/shipments/${id}/cancel`),
  optimize: (id) => api.post(`/shipments/${id}/optimize`),
  getConsolidation: (from, to) => api.get('/shipments/consolidate', { params: { from, to } }),
}
