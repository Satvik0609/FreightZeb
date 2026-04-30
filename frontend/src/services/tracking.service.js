import api from './api'

export const trackingService = {
  update: (data) => api.post('/tracking/update', data),
  getHistory: (bookingId) => api.get(`/tracking/${bookingId}`),
  getLatest: (bookingId) => api.get(`/tracking/${bookingId}/latest`),

  getDirections: (originLat, originLng, destLat, destLng) =>
    api.get('/maps/directions', { params: { originLat, originLng, destLat, destLng } }),

  /** Full route intelligence — traffic, steps, delay, avg speed, tolls */
  getRouteIntelligence: (originLat, originLng, destLat, destLng) =>
    api.get('/maps/route-intelligence', { params: { originLat, originLng, destLat, destLng } }),
}
