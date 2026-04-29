import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, PlusCircle, RefreshCw } from 'lucide-react'
import { bookingsService } from '@/services/bookings.service'
import { useAuthStore } from '@/store/authStore'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/ui/Skeleton'
import Table from '@/components/ui/Table'
import { formatCurrency, formatRelative } from '@/utils/formatters'
import { BOOKING_STATUSES } from '@/utils/constants'
import { normalizeBooking } from '@/utils/normalizers'

const STATUS_STEP_MAP = {
  REQUESTED: 0, APPROVED: 1, ASSIGNED: 2, PICKED_UP: 3, IN_TRANSIT: 4, DELIVERED: 5, REJECTED: -1, CANCELLED: -1
}

function StatusStepper({ status }) {
  const steps = ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']
  const current = STATUS_STEP_MAP[status] ?? 0
  const isFailed = status === 'REJECTED' || status === 'CANCELLED'

  if (isFailed) {
    return (
      <div className="flex items-center">
        <StatusBadge status={status} size="sm" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`w-2 h-2 rounded-full transition-colors ${
            i < current ? 'bg-green-500' :
            i === current ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
          }`} />
          {i < steps.length - 1 && (
            <div className={`w-4 h-0.5 ${i < current ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function BookingsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', user?.role, user?.id],
    queryFn: () => {
      if (user?.role === 'ADMIN') return bookingsService.getAll()
      if (user?.role === 'DEALER') return bookingsService.getDealer()
      return bookingsService.getMy()
    },
    staleTime: 30 * 1000,
    refetchInterval: 15 * 1000,
  })

  const rawBookings = (data?.bookings || data?.data || [])
  const bookings = rawBookings.map(normalizeBooking).filter((b) => {
    const matchSearch = !search ||
      b.shipment?.origin?.toLowerCase().includes(search.toLowerCase()) ||
      b.shipment?.destinationLabel?.toLowerCase().includes(search.toLowerCase()) ||
      b.truck?.registrationNumber?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || b.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    {
      key: 'shipment', label: 'Route', render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {row.shipment?.origin} → {row.shipment?.destinationLabel}
          </p>
          <p className="text-xs text-gray-500">{row.truck?.registrationNumber || 'No truck'}</p>
        </div>
      )
    },
    {
      key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} />
    },
    {
      key: 'progress', label: 'Progress', render: (_, row) => <StatusStepper status={row.status} />
    },
    {
      key: 'totalAmount', label: 'Amount', sortable: true,
      render: (v) => <span className="text-sm font-medium">{v ? formatCurrency(v) : '—'}</span>
    },
    {
      key: 'createdAt', label: 'Created', sortable: true,
      render: (v) => <span className="text-xs text-gray-500">{formatRelative(v)}</span>
    },
  ]

  const goToShipments = () => {
    // Primary: SPA navigation
    navigate('/shipments')
    // Failsafe: if router state is stale, force hard navigation.
    setTimeout(() => {
      if (window.location.pathname !== '/shipments') {
        window.location.assign('/shipments')
      }
    }, 120)
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
      />

      <Card padding={false} className="mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search route or truck..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            className="flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={BOOKING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            placeholder="All Statuses"
            className="w-44"
          />
        </div>

        {isLoading ? <SkeletonTable rows={5} cols={5} /> : (
          bookings.length === 0 ? (
            <div className="p-8 text-center space-y-4">
              <EmptyState
                icon={BookOpen}
                title="No bookings found"
                description={
                  search || statusFilter
                    ? 'No bookings match the current filters.'
                    : user?.role === 'WAREHOUSE'
                      ? 'No bookings exist for this warehouse account yet. Create a booking from a shipment to see it here.'
                      : 'No bookings are available for this account yet.'
                }
              />
              <div className="flex items-center justify-center gap-2">
                {user?.role === 'WAREHOUSE' && !search && !statusFilter && (
                  <button
                    onClick={goToShipments}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Go to Shipments
                  </button>
                )}
                {(search || statusFilter) && (
                  <button
                    onClick={() => { setSearch(''); setStatusFilter('') }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Clear Filters
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Scope: {user?.role === 'WAREHOUSE' ? 'My warehouse bookings (/bookings/my)' : user?.role === 'DEALER' ? 'My dealer bookings (/bookings/dealer)' : 'All bookings (/bookings)'}
              </p>
            </div>
          ) : (
            <Table columns={columns} data={bookings} onRowClick={(row) => navigate(`/bookings/${row.id}`)} />
          )
        )}
      </Card>
    </div>
  )
}
