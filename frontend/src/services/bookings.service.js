import api from './api'

export const bookingsService = {
  create: (data) => api.post('/bookings', data),
  dealerAccept: (data) => api.post('/bookings/dealer-accept', data),
  getMy: () => api.get('/bookings/my'),
  getDealer: () => api.get('/bookings/dealer'),
  getAll: () => api.get('/bookings'),
  getById: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, status, notes) => api.patch(`/bookings/${id}/status`, { status, notes }),
}
