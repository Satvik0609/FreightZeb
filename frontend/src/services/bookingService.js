import { get, patch, post, normalizeEntity, normalizeList } from "./http";

export const bookingService = {
  listMine: async (params) => normalizeList(await get("/bookings/my", { params }), "items"),
  listDealer: async (params) => normalizeList(await get("/bookings/dealer", { params }), "items"),
  listAll: async (params) => normalizeList(await get("/bookings", { params }), "items"),
  getOne: async (id) => normalizeEntity(await get(`/bookings/${id}`), "booking"),
  create: async (payload) => normalizeEntity(await post("/bookings", payload), "booking"),
  dealerAccept: async (payload) => normalizeEntity(await post("/bookings/dealer-accept", payload), "booking"),
  updateStatus: async (id, payload) => normalizeEntity(await patch(`/bookings/${id}/status`, payload), "booking"),
};
