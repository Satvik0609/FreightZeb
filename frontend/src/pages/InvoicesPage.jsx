import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Search, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesService } from '@/services/invoices.service'
import { useAuthStore } from '@/store/authStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { INVOICE_STATUSES } from '@/utils/constants'
import { normalizeInvoice } from '@/utils/normalizers'

function InvoiceDetail({ invoice, onClose }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const payMutation = useMutation({
    mutationFn: () => invoicesService.pay(invoice.id),
    onSuccess: () => { toast.success('Invoice marked as paid'); qc.invalidateQueries({ queryKey: ['invoices'] }); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => invoicesService.cancel(invoice.id),
    onSuccess: () => { toast.success('Invoice cancelled'); qc.invalidateQueries({ queryKey: ['invoices'] }); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const breakdown = invoice.breakdown || {}

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">#{invoice.invoiceNumber}</h3>
          <p className="text-sm text-gray-500">Booking: {invoice.booking?.id?.slice(-8)}</p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="space-y-2 text-sm">
        {[
          { label: 'Route', value: `${invoice.booking?.shipment?.origin} → ${invoice.booking?.shipment?.destinationLabel}` },
          { label: 'Truck', value: invoice.booking?.truck?.registrationNumber },
          { label: 'Due Date', value: formatDate(invoice.dueDate) },
          { label: 'Created', value: formatDate(invoice.createdAt) },
        ].map((item) => (
          <div key={item.label} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">{item.label}</span>
            <span className="font-medium text-gray-900 dark:text-white">{item.value || '—'}</span>
          </div>
        ))}
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Price Breakdown</p>
          {Object.entries(breakdown).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
              <span className="font-medium">{typeof v === 'number' ? formatCurrency(v) : v}</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
            <span>Total</span>
            <span>{formatCurrency(invoice.amount)}</span>
          </div>
        </div>
      )}

      {!Object.keys(breakdown).length && (
        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Total Amount</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(invoice.amount)}</span>
        </div>
      )}

      {isAdmin && invoice.status === 'PENDING' && (
        <div className="flex gap-3">
          <Button onClick={() => payMutation.mutate()} loading={payMutation.isPending} variant="success" className="flex-1">
            <CheckCircle className="w-4 h-4 mr-1" /> Mark Paid
          </Button>
          <Button onClick={() => { if(confirm('Cancel invoice?')) cancelMutation.mutate() }} loading={cancelMutation.isPending} variant="danger" className="flex-1">
            <XCircle className="w-4 h-4 mr-1" /> Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const isAdmin = user?.role === 'ADMIN'
  const isWarehouse = user?.role === 'WAREHOUSE'

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', user?.role, user?.id],
    queryFn: () => isAdmin ? invoicesService.getAll() : invoicesService.getMy(),
    staleTime: 30 * 1000,
    enabled: isAdmin || isWarehouse,
    refetchInterval: 15 * 1000,
  })

  const invoices = (data?.invoices || data?.data || []).map(normalizeInvoice).filter((inv) => {
    const matchSearch = !search || (inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = !statusFilter || inv.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #', sortable: true, render: (v) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'booking', label: 'Route', render: (_, row) => (
      <div>
        <p className="text-sm">{row.booking?.shipment?.origin} → {row.booking?.shipment?.destinationLabel}</p>
        <p className="text-xs text-gray-500">{row.booking?.truck?.registrationNumber || '—'}</p>
      </div>
    )},
    { key: 'amount', label: 'Amount', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'dueDate', label: 'Due Date', sortable: true, render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(v)}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => <span className="text-xs text-gray-400">{formatDate(v)}</span> },
  ]

  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + (i.amount || 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <div>
      {!isAdmin && !isWarehouse ? (
        <Card className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="font-medium text-gray-900 dark:text-white">Invoices are available for warehouse and admin accounts.</p>
        </Card>
      ) : (
        <>
      <PageHeader title="Invoices" subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending Amount', value: formatCurrency(totalPending), color: 'amber', icon: DollarSign },
          { label: 'Paid Amount', value: formatCurrency(totalPaid), color: 'green', icon: CheckCircle },
          { label: 'Total Invoices', value: invoices.length, color: 'blue', icon: FileText },
        ].map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card padding={false}>
        <div className="p-4 flex gap-3">
          <Input placeholder="Search invoice number..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} className="flex-1" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={INVOICE_STATUSES.map(s => ({ value: s, label: s }))} placeholder="All Statuses" className="w-40" />
        </div>

        {isLoading ? <SkeletonTable rows={5} cols={6} /> : (
          invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found"
              description="Invoices are auto-created when a booking is delivered."
              action={isWarehouse ? () => navigate('/bookings') : undefined}
              actionLabel={isWarehouse ? 'Go to Bookings' : undefined}
            />
          ) : (
            <Table columns={columns} data={invoices} onRowClick={(row) => setSelectedInvoice(row)} />
          )
        )}
      </Card>

      <Modal isOpen={!!selectedInvoice} onClose={() => setSelectedInvoice(null)} title="Invoice Details">
        {selectedInvoice && <InvoiceDetail invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      </Modal>
        </>
      )}
    </div>
  )
}
