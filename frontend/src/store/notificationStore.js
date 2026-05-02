import { create } from 'zustand'

export const useNotificationStore = create((set) => ({
    notifications: [],
    unreadCount: 0,
    setNotifications: (notifications = []) =>
        set({
            notifications,
            unreadCount: notifications.filter((n) => !(n.read ?? n.isRead)).length,
        }),
    setUnreadCount: (valueOrUpdater) =>
        set((state) => {
            const nextValue = typeof valueOrUpdater === 'function'
                ? valueOrUpdater(state.unreadCount)
                : valueOrUpdater;
            return { unreadCount: Math.max(0, Number(nextValue) || 0) };
        }),
    addNotification: (notification) =>
        set((state) => {
            if (!notification?.id) return state;
            const exists = state.notifications.some((n) => n.id === notification.id);
            const notifications = exists
                ? state.notifications.map((n) => (n.id === notification.id ? { ...n, ...notification } : n))
                : [notification, ...state.notifications];
            return {
                notifications,
                unreadCount: notifications.filter((n) => !(n.read ?? n.isRead)).length,
            };
        }),
    markRead: (id) =>
        set((state) => {
            const notifications = state.notifications.map((n) =>
                n.id === id ? { ...n, read: true, isRead: true } : n
            );
            return {
                notifications,
                unreadCount: notifications.filter((n) => !(n.read ?? n.isRead)).length,
            };
        }),
    markAllRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true, isRead: true })),
            unreadCount: 0,
        })),
    removeNotification: (id) =>
        set((state) => {
            const notifications = state.notifications.filter((n) => n.id !== id);
            return {
                notifications,
                unreadCount: notifications.filter((n) => !(n.read ?? n.isRead)).length,
            };
        }),
}))
