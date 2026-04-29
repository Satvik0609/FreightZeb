import { useState, useRef, useEffect } from 'react'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { useNotifications } from '@/hooks/useNotifications'
import { formatRelative } from '@/utils/formatters'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { unreadCount, notifications } = useNotificationStore()
  const { readOne, readAll } = useNotifications()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const recent = notifications.slice(0, 5)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => readAll.mutate()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No notifications</p>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <button onClick={() => readOne.mutate(n.id)} className="text-gray-400 hover:text-blue-500">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => { navigate('/notifications'); setOpen(false) }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline w-full text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
