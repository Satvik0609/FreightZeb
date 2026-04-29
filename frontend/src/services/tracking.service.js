import api from './api'

export const trackingService = {
  update:     (data)      => api.post('/tracking/update', data),
  getHistory: (bookingId) => api.get(`/tracking/${bookingId}`),
  getLatest:  (bookingId) => api.get(`/tracking/${bookingId}/latest`),

  /**
   * Fetch a driving-directions route from the backend proxy.
   * Returns { routePath, distanceKm, durationMin, distanceText, durationText, … }
   */
  getDirections: (originLat, originLng, destLat, destLng) =>
    api.get('/maps/directions', {
      params: { originLat, originLng, destLat, destLng },
    }),
}
