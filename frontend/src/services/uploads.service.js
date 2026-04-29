import api from './api'

export const uploadsService = {
  uploadAvatar: (file) => {
    const fd = new FormData()
    fd.append('avatar', file)
    return api.post('/uploads/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteAvatar: () => api.delete('/uploads/avatar'),
  uploadProof: (bookingId, photos, signature) => {
    const fd = new FormData()
    photos.forEach((p) => fd.append('photos', p))
    if (signature) fd.append('signature', signature)
    return api.post(`/uploads/proof/${bookingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  getProof: (bookingId) => api.get(`/uploads/proof/${bookingId}`),
  uploadDocument: (shipmentId, file) => {
    const fd = new FormData()
    fd.append('document', file)
    return api.post(`/uploads/document/${shipmentId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
