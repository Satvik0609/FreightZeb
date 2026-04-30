import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '@/services/notifications.service'
import { useNotificationStore } from '@/store/notificationStore'
import { normalizeNotification } from '@/utils/normalizers'

export function useNotifications() {
    const { setNotifications, setUnreadCount, markRead, markAllRead, removeNotification } = useNotificationStore()
    const qc = useQueryClient()
    const syncQuery = () => qc.invalidateQueries({ queryKey: ['notifications'] })

    const query = useQuery({
        queryKey: ['notifications', {}],
        queryFn: async ({ queryKey }) => {
            const params = queryKey[1] || {}
            const res = await notificationsService.getAll(params)
            const notifs = (res.notifications || res.data || []).map(normalizeNotification)
            setNotifications(notifs)
            if (typeof res.unreadCount === 'number') setUnreadCount(res.unreadCount)
            return notifs
        },
        staleTime: 30 * 1000,
    })

    const readOne = useMutation({
        mutationFn: (id) => notificationsService.readOne(id),
        onMutate: (id) => markRead(id),
        onSuccess: (res) => {
            if (typeof res?.unreadCount === 'number') setUnreadCount(res.unreadCount)
            syncQuery()
        },
        onError: () => syncQuery(),
    })

    const readAll = useMutation({
        mutationFn: () => notificationsService.readAll(),
        onMutate: () => markAllRead(),
        onSuccess: (res) => {
            if (typeof res?.unreadCount === 'number') setUnreadCount(res.unreadCount)
            syncQuery()
        },
        onError: () => syncQuery(),
    })

    const deleteOne = useMutation({
        mutationFn: (id) => notificationsService.delete(id),
        onMutate: (id) => removeNotification(id),
        onSuccess: () => syncQuery(),
        onError: () => syncQuery(),
    })

    return { ...query, readOne, readAll, deleteOne }
}
