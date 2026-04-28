import { del, get, patch, normalizeEntity, normalizeList } from "./http";

export const notificationService = {
  list: async (params) => {
    const payload = await get("/notifications", { params });
    return { ...normalizeList(payload, "notifications"), unreadCount: payload?.unreadCount || 0 };
  },
  markRead: async (id) => normalizeEntity(await patch(`/notifications/${id}/read`), "notification"),
  markAllRead: async () => patch("/notifications/read-all"),
  remove: async (id) => del(`/notifications/${id}`),
};
