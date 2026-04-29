import api from './api'

export const notificationsService = {
  getAll: (params = {}) => api.get('/notifications', { params }),
  readAll: () => api.patch('/notifications/mark-all-read'),
  readOne: (id) => api.patch(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
}
