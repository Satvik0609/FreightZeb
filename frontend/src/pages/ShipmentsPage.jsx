import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Package, LayoutGrid, List, Truck, CheckCircle2, Clock, Weight, MapPin, Bell } from 'lucide-react'
import { shipmentsService } from '@/services/shipments.service'
import { bookingsService } from '@/services/bookings.service'
import { trucksService } from '@/services/trucks.service'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/ui/Skeleton'
import ShipmentForm from '@/features/shipments/ShipmentForm'
import { formatDate, formatWeight } from '@/utils/formatters'
import { SHIPMENT_STATUSES } from '@/utils/constants'
import { normalizeShipment, normalizeTruck, haversineKm } from '@/utils/normalizers'
import toast from 'react-hot-toast'

// ── Accept Shipment Modal (Dealer) ────────────────────────────────────────────
function AcceptShipmentModal({ shipment, onClose }) {
  const queryClient = useQueryClient()
  const [selectedTruckId, setSelectedTruckId] = useState('')

  const trucksQuery = useQuery({
    queryKey: ['my-trucks'],
    queryFn: () => trucksService.getMy(),
    staleTime: 30_000,
  })

  const myTrucks = (trucksQuery.data?.trucks || trucksQuery.data?.data || [])
    .map(normalizeTruck)
    .filter((t) => t.availability !== false && t.status !== 'BOOKED' && t.status !== 'IN_TRANSIT')

  const acceptMutation = useMutation({
    mutationFn: () => bookingsService.dealerAccept({
      shipmentId: shipment.id,
      truckId: selectedTruckId,
    }),
    onSuccess: () => {
      toast.success('Shipment accepted! Booking created.')
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      onClose()
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to accept shipment'),
  })

  const distKm = haversineKm(
    shipment.pickupLocation?.lat, shipment.pickupLocation?.lng,
    shipment.destination?.lat, shipment.destination?.lng,
  )

  return (
    <div className="space-y-5">
      {/* Shipment summary */}
      <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-500" />
          <p className="font-semibold text-indigo-800 dark:text-indigo-200 text-sm">
            {shipment.origin} → {shipment.destinationLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-indigo-600 dark:text-indigo-400">
          <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{formatWeight(shipment.weightKg)}</span>
          {distKm && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{distKm} km (est.)</span>}
          {shipment.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due {formatDate(shipment.deadline)}</span>}
          <span className="font-medium">{shipment.cargoType}</span>
        </div>
        {shipment.description && (
          <p className="text-xs text-indigo-500 dark:text-indigo-400 italic">{shipment.description}</p>
        )}
      </div>

      {/* Truck selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select your truck
        </label>
        {trucksQuery.isLoading ? (
          <p className="text-sm text-gray-400">Loading your trucks...</p>
        ) : myTrucks.length === 0 ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 p-3 text-sm text-amber-700 dark:text-amber-400">
            No available trucks. Add a truck or free up one that's currently booked.
          </div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {myTrucks.map((truck) => (
              <button
                key={truck.id}
                onClick={() => setSelectedTruckId(truck.id)}
                className={[
                  'w-full text-left rounded-xl border p-3 transition-all',
                  selectedTruckId === truck.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {truck.registrationNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(truck.truckType || '').replace(/_/g, ' ')} · {truck.capacityWeight ? `${Number(truck.capacityWeight).toLocaleString()} kg` : '—'}
                      </p>
                    </div>
                  </div>
                  {selectedTruckId === truck.id && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={!selectedTruckId || myTrucks.length === 0}
          loading={acceptMutation.isPending}
          onClick={() => acceptMutation.mutate()}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> Accept Shipment
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [showCreate, setShowCreate] = useState(false)
  const [acceptingShipment, setAcceptingShipment] = useState(null)

  const isDealer = user?.role === 'DEALER' || user?.role === 'CARGO_DEALER'

  const { data, isLoading } = useQuery({
    queryKey: ['shipments', user?.role],
    queryFn: () => {
      if (user?.role === 'ADMIN') return shipmentsService.getAll()
      if (isDealer) return shipmentsService.getAvailable()
      return shipmentsService.getMy()
    },
    staleTime: 30 * 1000,
    enabled: Boolean(user),
  })

  // ── Real-time: new shipment created by warehouse ──────────────────────────
  useEffect(() => {
    if (!token) return
    const socket = getSocket(token)

    const onNewShipment = (payload) => {
      // Dealers: auto-refresh the available list + show toast
      if (isDealer) {
        queryClient.invalidateQueries({ queryKey: ['shipments'] })
        toast(`📦 New shipment: ${payload.origin || '?'} → ${payload.destination || '?'} · ${payload.weightKg ? `${Number(payload.weightKg).toLocaleString()} kg` : ''}`, {
          icon: '🚚',
          duration: 5000,
        })
      }
      // Warehouse: also refresh their own list (e.g. another tab)
      if (user?.role === 'WAREHOUSE' && payload.warehouseId === user.id) {
        queryClient.invalidateQueries({ queryKey: ['shipments'] })
      }
    }

    socket.on('shipment:new', onNewShipment)
    return () => socket.off('shipment:new', onNewShipment)
  }, [token, isDealer, user?.id, queryClient])

  // ── Real-time: dealer accepted warehouse's shipment ───────────────────────
  useEffect(() => {
    if (!token || user?.role !== 'WAREHOUSE') return
    const socket = getSocket(token)

    const onAccepted = (payload) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      toast.success(`🚛 Your shipment was accepted by a truck dealer!`, { duration: 5000 })
    }
    const onStatusUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    }

    socket.on('shipment:accepted', onAccepted)
    socket.on('shipment:statusUpdate', onStatusUpdate)
    return () => {
      socket.off('shipment:accepted', onAccepted)
      socket.off('shipment:statusUpdate', onStatusUpdate)
    }
  }, [token, user?.role, queryClient])

  const shipments = (data?.shipments || data?.data || []).map(normalizeShipment).filter((s) => {
    const matchSearch = !search || `${s.origin} ${s.destinationLabel} ${s.description || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchStatus
  })

  // Dealer-specific columns — show warehouse company + accept button
  const dealerColumns = [
    {
      key: 'origin', label: 'Route', render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">{row.origin} → {row.destinationLabel}</p>
          <p className="text-xs text-gray-500">{formatWeight(row.weightKg)} {row.volumeM3 ? `• ${row.volumeM3} m³` : ''}</p>
        </div>
      )
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'cargoType', label: 'Cargo', render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{v}</span> },
    {
      key: 'warehouse', label: 'From', render: (_, row) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.warehouse?.company || row.warehouse?.name || '—'}
        </span>
      )
    },
    { key: 'deadline', label: 'Deadline', render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(v)}</span> },
    {
      key: 'actions', label: '', render: (_, row) => (
        <Button
          size="xs"
          onClick={(e) => { e.stopPropagation(); setAcceptingShipment(row) }}
        >
          <Truck className="w-3 h-3 mr-1" /> Accept
        </Button>
      )
    },
  ]

  const warehouseColumns = [
    {
      key: 'origin', label: 'Route', sortable: true, render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">{row.origin} → {row.destinationLabel}</p>
          <p className="text-xs text-gray-500">{formatWeight(row.weightKg)} {row.volumeM3 ? `• ${row.volumeM3} m³` : ''}</p>
        </div>
      )
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'cargoType', label: 'Cargo', render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{v}</span> },
    {
      key: 'priority', label: 'Priority', render: (v) => (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${v === 'URGENT' ? 'bg-red-100 text-red-700' :
          v === 'HIGH' ? 'bg-orange-100 text-orange-700' :
            v === 'NORMAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
          }`}>{v}</span>
      )
    },
    { key: 'deadline', label: 'Deadline', sortable: true, render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(v)}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => <span className="text-sm text-gray-500">{formatDate(v)}</span> },
  ]

  const columns = isDealer ? dealerColumns : warehouseColumns

  return (
    <div>
      <PageHeader
        title={isDealer ? 'Available Shipments' : 'Shipments'}
        subtitle={isDealer
          ? `${shipments.length} open request${shipments.length !== 1 ? 's' : ''} waiting for a truck`
          : `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}`
        }
        actions={
          !isDealer && user?.role !== 'ADMIN' && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Shipment
            </Button>
          )
        }
      />

      <Card padding={false} className="mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <Input
            placeholder={isDealer ? 'Search by origin or destination...' : 'Search by origin or destination...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            className="flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={SHIPMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            placeholder="All Statuses"
            className="w-44"
          />
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}>
              <List className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}>
              <LayoutGrid className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {isLoading ? <SkeletonTable rows={5} cols={6} /> : (
          shipments.length === 0 ? (
            <EmptyState
              icon={Package}
              title={isDealer ? 'No open shipment requests' : 'No shipments found'}
              description={
                search || statusFilter
                  ? 'Try adjusting your filters'
                  : isDealer
                    ? 'New shipment requests from warehouses will appear here'
                    : 'Create your first shipment to get started'
              }
              action={!search && !statusFilter && !isDealer && user?.role !== 'ADMIN' ? () => setShowCreate(true) : undefined}
              actionLabel="Create Shipment"
            />
          ) : viewMode === 'table' ? (
            <Table
              columns={columns}
              data={shipments}
              onRowClick={isDealer ? undefined : (row) => navigate(`/shipments/${row.id}`)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {shipments.map((s) => (
                <Card
                  key={s.id}
                  hover={!isDealer}
                  onClick={!isDealer ? () => navigate(`/shipments/${s.id}`) : undefined}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{s.origin}</p>
                  <p className="text-xs text-gray-500 mb-1">→ {s.destinationLabel}</p>
                  <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span>{formatWeight(s.weightKg)}</span>
                    <span>•</span>
                    <span>{s.cargoType}</span>
                    {s.deadline && <><span>•</span><span>{formatDate(s.deadline)}</span></>}
                  </div>
                  {isDealer && (
                    <Button size="sm" className="w-full" onClick={() => setAcceptingShipment(s)}>
                      <Truck className="w-3.5 h-3.5 mr-1" /> Accept
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )
        )}
      </Card>

      {/* Warehouse: create shipment */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Shipment" size="lg">
        <ShipmentForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
      </Modal>

      {/* Dealer: accept shipment */}
      <Modal
        isOpen={Boolean(acceptingShipment)}
        onClose={() => setAcceptingShipment(null)}
        title="Accept Shipment Request"
        size="md"
      >
        {acceptingShipment && (
          <AcceptShipmentModal
            shipment={acceptingShipment}
            onClose={() => setAcceptingShipment(null)}
          />
        )}
      </Modal>
    </div>
  )
}
