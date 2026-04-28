import { get, post } from "./http";

export const trackingService = {
  history: async (bookingId) => get(`/tracking/${bookingId}`),
  latest: async (bookingId) => get(`/tracking/${bookingId}/latest`),
  push: async (payload) => post("/tracking/update", payload),
};
