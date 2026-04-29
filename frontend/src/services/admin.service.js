import api from './api'

export const adminService = {
  getUsers: () => api.get('/admin/users'),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  changeRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
}
