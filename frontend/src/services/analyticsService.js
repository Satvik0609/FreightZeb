import { get } from "./http";

export const analyticsService = {
  warehouseSummary: async () => get("/analytics/warehouse"),
  warehouseCharts: async (params) => get("/analytics/warehouse/charts", { params }),
  dealerSummary: async () => get("/analytics/dealer"),
  dealerCharts: async (params) => get("/analytics/dealer/charts", { params }),
  adminSummary: async () => get("/analytics/admin"),
  adminCharts: async (params) => get("/analytics/admin/charts", { params }),
};
