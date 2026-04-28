import { del, get, patch, post, normalizeEntity, normalizeList } from "./http";

export const shipmentService = {
  listMine: async (params) => normalizeList(await get("/shipments/my", { params }), "shipments"),
  listAll: async (params) => normalizeList(await get("/shipments", { params }), "shipments"),
  getOne: async (id) => normalizeEntity(await get(`/shipments/${id}`), "shipment"),
  create: async (payload) => normalizeEntity(await post("/shipments", payload), "shipment"),
  cancel: async (id) => normalizeEntity(await patch(`/shipments/${id}/cancel`), "shipment"),
  optimize: async (id) => post(`/shipments/${id}/optimize`),
  getClusters: async (params) => get("/ml/cluster-shipments", { params }),
  deleteDocument: async () => del(""),
};
