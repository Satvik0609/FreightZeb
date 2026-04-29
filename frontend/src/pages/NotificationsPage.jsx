import { useMemo, useState } from 'react'
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, Package, Truck, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { useNotifications } from '@/hooks/useNotifications'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatRelative } from '@/utils/formatters'

const TYPE_ICONS = {
  booking: Package,
  truck: Truck,
  alert: AlertTriangle,
  default: Info,
}

const TYPE_COLORS = {
  booking: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  truck: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
  alert: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
  default: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-700',
}

const PRIORITY_BADGES = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications } = useNotificationStore()
  const { isLoading, readOne, readAll, deleteOne } = useNotifications()
  const [tab, setTab] = useState('all')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const uniqueTypes = useMemo(
    () => ['ALL', ...Array.from(new Set(notifications.map((n) => n.type).filter(Boolean)))],
    [notifications]
  )

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const unreadOk = tab === 'unread' ? !n.read : true
      const typeOk = typeFilter === 'ALL' ? true : n.type === typeFilter
      return unreadOk && typeOk
    })
  }, [notifications, tab, typeFilter])

  const emptyMessage = tab === 'unread'
    ? 'No unread notifications'
    : typeFilter !== 'ALL'
      ? `No notifications found for type ${typeFilter}`
      : 'No notifications yet'

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${notifications.filter(n => !n.read).length} unread`}
        actions={
          notifications.some(n => !n.read) && (
            <Button size="sm" variant="secondary" onClick={() => readAll.mutate()} loading={readAll.isPending}>
              <CheckCheck className="w-4 h-4 mr-1" /> Mark All Read
            </Button>
          )
        }
      />

      <Card padding={false} className="mb-4">
        <div className="p-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTab('unread')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Unread
          </button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
            >
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <SkeletonCard key={i} className="p-4" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="font-medium text-gray-900 dark:text-white">All caught up!</p>
          <p className="text-sm text-gray-400 mt-1">{emptyMessage}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const type = n.type?.toLowerCase()?.includes('booking')
              ? 'booking'
              : n.type?.toLowerCase()?.includes('trip') || n.type?.toLowerCase()?.includes('truck')
                ? 'truck'
                : n.type?.toLowerCase()?.includes('alert')
                  ? 'alert'
                  : 'default'
            const Icon = TYPE_ICONS[type] || TYPE_ICONS.default
            const colorClass = TYPE_COLORS[type] || TYPE_COLORS.default

            return (
              <Card
                key={n.id}
                padding={false}
                className={`transition-all ${!n.read ? 'border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
              >
                <div className="flex items-start gap-4 p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${PRIORITY_BADGES[n.priority] || PRIORITY_BADGES.info}`}>
                            {n.priority || 'info'}
                          </span>
                          {n.type && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {n.type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                        {n.actionUrl && (
                          <button
                            onClick={() => {
                              if (!n.read) readOne.mutate(n.id)
                              navigate(n.actionUrl)
                            }}
                            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            Open related item <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && (
                      <button
                        onClick={() => readOne.mutate(n.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteOne.mutate(n.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
