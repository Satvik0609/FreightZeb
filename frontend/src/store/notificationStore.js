import { create } from 'zustand'
import { normalizeNotification } from '@/utils/normalizers'

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set(() => {
      const normalized = notifications.map(normalizeNotification)
      return {
        notifications: normalized,
        unreadCount: normalized.filter((n) => !n.read).length,
      }
    }),

  setUnreadCount: (count) =>
    set({ unreadCount: Math.max(0, Number(count) || 0) }),

  addNotification: (notification) =>
    set((state) => {
      const normalized = normalizeNotification(notification)
      if (state.notifications.some((n) => n.id === normalized.id)) {
        return state
      }
      return {
        notifications: [normalized, ...state.notifications],
        unreadCount: state.unreadCount + (normalized.read ? 0 : 1),
      }
    }),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true, isRead: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const notif = state.notifications.find((n) => n.id === id)
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notif && !notif.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      }
    }),
}))
