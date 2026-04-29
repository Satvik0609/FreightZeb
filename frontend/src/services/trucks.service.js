import api from './api'

export const trucksService = {
  create: (data) => api.post('/trucks', data),
  getMy: () => api.get('/trucks/my'),
  getAvailable: () => api.get('/trucks/available'),
  getAll: () => api.get('/trucks'),
  getById: (id) => api.get(`/trucks/${id}`),
  update: (id, data) => api.patch(`/trucks/${id}`, data),
  updateLocation: (id, lat, lng) => api.patch(`/trucks/${id}/location`, { lat, lng }),
  delete: (id) => api.delete(`/trucks/${id}`),
  optimizeLoading: (data) => api.post('/trucks/optimize-loading', data),
}
