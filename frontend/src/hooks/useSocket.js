import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { normalizeNotification } from '@/utils/normalizers'
import { queryClient } from '@/lib/queryClient'

function invalidateRealtimeData() {
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
  queryClient.invalidateQueries({ queryKey: ['bookings'] })
  queryClient.invalidateQueries({ queryKey: ['shipments'] })
  queryClient.invalidateQueries({ queryKey: ['trucks'] })
  queryClient.invalidateQueries({ queryKey: ['tracking'] })
  queryClient.invalidateQueries({ queryKey: ['invoices'] })
  queryClient.invalidateQueries({ queryKey: ['analytics'] })
  queryClient.invalidateQueries({ queryKey: ['analytics-full'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard-shipments'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard-pending-bookings'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard-warehouse-bookings'] })
}

export function useSocket() {
  const { user, token, isAuthenticated } = useAuthStore()
  const { addNotification, setUnreadCount } = useNotificationStore()

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !token) return

    const socket = getSocket(token)
    socket.connect()

    socket.emit('join', `user:${user.id}`)
    socket.emit('join', `${user.role?.toLowerCase()}:${user.id}`)

    const handleNotification = (data) => {
      addNotification(normalizeNotification({ ...data, id: data.id || Date.now(), createdAt: data.createdAt || new Date().toISOString() }))
      setUnreadCount((useNotificationStore.getState().notifications || []).filter((n) => !n.read).length)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast(data.title || data.message, { icon: '🔔' })
    }

    const handleBookingEvent = (data) => {
      invalidateRealtimeData()
      if (data?.status) {
        toast(`Booking updated: ${data.status}`, { icon: '📦' })
      }
    }
    const handleBookingRequested = (data) => {
      invalidateRealtimeData()
      const route = data?.shipmentId ? `shipment ${String(data.shipmentId).slice(0, 8)}` : 'new shipment'
      toast(`New booking request received for ${route}`, { icon: '📦' })
    }

    const handleTrackingEvent = () => {
      invalidateRealtimeData()
    }

    socket.on('notification:new', handleNotification)
    socket.on('booking:requested', handleBookingRequested)
    socket.on('booking:statusUpdate', handleBookingEvent)
    socket.on('tracking:update', handleTrackingEvent)
    socket.on('truck:location', handleTrackingEvent)

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message)
    })

    return () => {
      socket.off('notification:new', handleNotification)
      socket.off('booking:requested', handleBookingRequested)
      socket.off('booking:statusUpdate', handleBookingEvent)
      socket.off('tracking:update', handleTrackingEvent)
      socket.off('truck:location', handleTrackingEvent)
      disconnectSocket()
    }
  }, [isAuthenticated, user?.id, token])
}

export function useBookingSocket(bookingId, onStatusUpdate) {
  const { token, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !bookingId) return

    const socket = getSocket(token)
    if (!socket.connected) socket.connect()

    socket.emit('join', `booking:${bookingId}`)
    socket.on('booking:statusUpdate', onStatusUpdate)

    return () => {
      socket.off('booking:statusUpdate', onStatusUpdate)
    }
  }, [bookingId, isAuthenticated])
}

export function useTruckSocket(truckId, onLocation) {
  const { token, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !truckId) return

    const socket = getSocket(token)
    if (!socket.connected) socket.connect()

    socket.emit('join', `truck:${truckId}`)
    socket.on('truck:location', onLocation)
    socket.on('tracking:update', onLocation)

    return () => {
      socket.off('truck:location', onLocation)
      socket.off('tracking:update', onLocation)
    }
  }, [truckId, isAuthenticated])
}
