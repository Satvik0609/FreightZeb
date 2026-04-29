import api from './api'

export const invoicesService = {
  getMy: () => api.get('/invoices/my'),
  getAll: () => api.get('/invoices'),
  getById: (id) => api.get(`/invoices/${id}`),
  pay: (id) => api.patch(`/invoices/${id}/pay`),
  cancel: (id) => api.patch(`/invoices/${id}/cancel`),
}
