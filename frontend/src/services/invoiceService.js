import { get, patch, normalizeEntity, normalizeList } from "./http";

export const invoiceService = {
  listMine: async (params) => normalizeList(await get("/invoices/my", { params }), "invoices"),
  listAll: async (params) => normalizeList(await get("/invoices", { params }), "invoices"),
  getOne: async (id) => normalizeEntity(await get(`/invoices/${id}`), "invoice"),
  markPaid: async (id) => normalizeEntity(await patch(`/invoices/${id}/pay`), "invoice"),
  cancel: async (id) => normalizeEntity(await patch(`/invoices/${id}/cancel`), "invoice"),
};
