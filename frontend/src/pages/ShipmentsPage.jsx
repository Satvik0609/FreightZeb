import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Package, LayoutGrid, List } from 'lucide-react'
import { shipmentsService } from '@/services/shipments.service'
import { useAuthStore } from '@/store/authStore'
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
import { normalizeShipment } from '@/utils/normalizers'

export default function ShipmentsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['shipments', user?.role],
    queryFn: () => user?.role === 'ADMIN' ? shipmentsService.getAll() : shipmentsService.getMy(),
    staleTime: 30 * 1000,
  })

  const shipments = (data?.shipments || data?.data || []).map(normalizeShipment).filter((s) => {
    const matchSearch = !search || `${s.origin} ${s.destinationLabel} ${s.description || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'origin', label: 'Route', sortable: true, render: (_, row) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white text-sm">{row.origin} → {row.destinationLabel}</p>
        <p className="text-xs text-gray-500">{formatWeight(row.weightKg)} {row.volumeM3 ? `• ${row.volumeM3} m³` : ''}</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'cargoType', label: 'Cargo', render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{v}</span> },
    { key: 'priority', label: 'Priority', render: (v) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        v === 'URGENT' ? 'bg-red-100 text-red-700' :
        v === 'HIGH' ? 'bg-orange-100 text-orange-700' :
        v === 'NORMAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
      }`}>{v}</span>
    )},
    { key: 'deadline', label: 'Deadline', sortable: true, render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(v)}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => <span className="text-sm text-gray-500">{formatDate(v)}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle={`${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}`}
        actions={
          user?.role !== 'ADMIN' && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Shipment
            </Button>
          )
        }
      />

      <Card padding={false} className="mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by origin or destination..."
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
              title="No shipments found"
              description={search || statusFilter ? "Try adjusting your filters" : "Create your first shipment to get started"}
              action={!search && !statusFilter && user?.role !== 'ADMIN' ? () => setShowCreate(true) : undefined}
              actionLabel="Create Shipment"
            />
          ) : viewMode === 'table' ? (
            <Table columns={columns} data={shipments} onRowClick={(row) => navigate(`/shipments/${row.id}`)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {shipments.map((s) => (
                <Card key={s.id} hover onClick={() => navigate(`/shipments/${s.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{s.origin}</p>
                  <p className="text-xs text-gray-500 mb-1">→ {s.destinationLabel}</p>
                  <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatWeight(s.weightKg)}</span>
                    <span>•</span>
                    <span>{s.cargoType}</span>
                    {s.deadline && <><span>•</span><span>{formatDate(s.deadline)}</span></>}
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </Card>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Shipment" size="lg">
        <ShipmentForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}
