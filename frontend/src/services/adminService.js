import { del, get, patch, normalizeEntity, normalizeList } from "./http";

export const adminService = {
  listUsers: async (params) => normalizeList(await get("/admin/users", { params }), "users"),
  getUser: async (id) => normalizeEntity(await get(`/admin/users/${id}`), "user"),
  updateRole: async (id, role) => normalizeEntity(await patch(`/admin/users/${id}/role`, { role }), "user"),
  toggleUser: async (id) => normalizeEntity(await patch(`/admin/users/${id}/toggle`), "user"),
  deleteUser: async (id) => del(`/admin/users/${id}`),
};
