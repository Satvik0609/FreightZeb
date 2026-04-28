import { create } from "zustand";

const STORAGE_KEY = "freightzen-auth";

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create((set) => ({
  ...loadAuth(),
  setSession: ({ token, user }) => {
    const next = { token, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set(next);
  },
  patchUser: (user) =>
    set((state) => {
      const next = { ...state, user: { ...state.user, ...user } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: next.token, user: next.user }));
      return next;
    }),
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
