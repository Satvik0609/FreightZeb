import { get, patch, post } from "./http";

export const authService = {
  login: async (payload) => post("/auth/login", payload),
  register: async (payload) => post("/auth/register", payload),
  forgotPassword: async (payload) => post("/auth/forgot-password", payload),
  resetPassword: async (payload) => post("/auth/reset-password", payload),
  me: async () => get("/auth/me"),
  updateProfile: async (payload) => patch("/auth/me", payload),
  changePassword: async (payload) => patch("/auth/me/password", payload),
};
