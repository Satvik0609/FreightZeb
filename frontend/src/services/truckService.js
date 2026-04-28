import { get, patch, post, normalizeEntity, normalizeList } from "./http";

export const truckService = {
  listMine: async (params) => normalizeList(await get("/trucks/my", { params }), "trucks"),
  listAll: async (params) => normalizeList(await get("/trucks", { params }), "trucks"),
  listAvailable: async (params) => normalizeList(await get("/trucks/available", { params }), "trucks"),
  getOne: async (id) => normalizeEntity(await get(`/trucks/${id}`), "truck"),
  create: async (payload) => normalizeEntity(await post("/trucks", payload), "truck"),
  update: async (id, payload) => normalizeEntity(await patch(`/trucks/${id}`, payload), "truck"),
  updateLocation: async (id, payload) => normalizeEntity(await patch(`/trucks/${id}/location`, payload), "truck"),
};
