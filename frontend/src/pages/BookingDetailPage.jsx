import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Truck, Package, DollarSign, CheckCircle, XCircle, Upload, Brain, RefreshCw, MapPin, AlertTriangle, Fuel, Wind, Ruler } from 'lucide-react'
import toast from 'react-hot-toast'
import { bookingsService } from '@/services/bookings.service'
import { mlService } from '@/services/ml.service'
import { trackingService } from '@/services/tracking.service'
import { uploadsService } from '@/services/uploads.service'
import { useAuthStore } from '@/store/authStore'
import { useBookingSocket } from '@/hooks/useSocket'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import StatusBadge from '@/components/shared/StatusBadge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatDate, formatDateTime, formatCurrency, formatRelative, formatWeight, formatDistance } from '@/utils/formatters'
import { BOOKING_STEPS } from '@/utils/constants'
import { normalizeBooking, normalizeTrackingLog, normalizePrediction } from '@/utils/normalizers'

const STATUS_TRANSITIONS = {
  ADMIN: {
    REQUESTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['DELIVERED'],
  },
  DEALER: {
    REQUESTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['ASSIGNED'],
    ASSIGNED: ['PICKED_UP'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['DELIVERED'],
  },
  WAREHOUSE: {
    REQUESTED: ['CANCELLED'],
    APPROVED: ['CANCELLED'],
  },
}

function StatusTimeline({ status }) {
  const steps = BOOKING_STEPS
  const currentIdx = steps.indexOf(status)
  const isFailed = ['REJECTED', 'CANCELLED'].includes(status)

  return (
    <div className="relative">
      {steps.map((step, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={step} className="flex gap-4 pb-6 last:pb-0 relative">
            {i < steps.length - 1 && (
              <div className={`absolute left-3.5 top-7 bottom-0 w-0.5 ${isPast ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
            <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isFailed && isCurrent ? 'bg-red-100 border-2 border-red-500' :
              isPast ? 'bg-green-500' :
                isCurrent ? 'bg-blue-600 border-2 border-blue-200' :
                  'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'
              }`}>
              {isPast ? <CheckCircle className="w-4 h-4 text-white" /> :
                isCurrent && !isFailed ? <div className="w-2 h-2 rounded-full bg-white" /> :
                  <div className="w-2 h-2 rounded-full bg-gray-400" />}
            </div>
            <div className="pt-0.5">
              <p className={`text-sm font-medium ${isCurrent ? 'text-blue-600 dark:text-blue-400' : isPast ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {step.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        )
      })}
      {isFailed && (
        <div className="flex gap-4 mt-2">
          <div className="w-7 h-7 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center shrink-0">
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-600 pt-0.5">{status}</p>
        </div>
      )}
    </div>
  )
}

function ProofUploadModal({ booking, onClose }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!files.length) { toast.error('Select at least one photo'); return }
    setLoading(true)
    try {
      await uploadsService.uploadProof(booking.id, Array.from(files))
      toast.success('Proof uploaded!')
      onClose()
    } catch {
      toast.error('Upload failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Upload delivery photos as proof of delivery.</p>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles(e.target.files)}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
      />
      {files.length > 0 && <p className="text-xs text-gray-500">{files.length} file(s) selected</p>}
      <div className="flex gap-3">
        <Button onClick={handleUpload} loading={loading} className="flex-1">Upload Proof</Button>
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
      </div>
    </div>
  )
}

function MLPredictionsPanel({ booking, onRefresh, isRefreshing }) {
  const predictions = (booking?.shipment?.predictions || []).map(normalizePrediction)
  const byType = Object.fromEntries(predictions.map((p) => [p.predictionType, p]))

  const eta = byType['ETA_HOURS']
  const delay = byType['DELAY_RISK_PERCENT']
  const fuel = byType['FUEL_ESTIMATE_LITERS']
  const co2 = byType['CO2_KG']

  const delayValue = delay ? Number(delay.value ?? delay.result?.delay_probability ?? 0) : null
  const delayRiskLevel = delayValue === null ? null
    : delayValue >= 70 ? { label: 'CRITICAL', color: 'text-red-600 dark:text-red-400' }
      : delayValue >= 45 ? { label: 'HIGH', color: 'text-orange-500 dark:text-orange-400' }
        : delayValue >= 20 ? { label: 'MODERATE', color: 'text-yellow-600 dark:text-yellow-400' }
          : { label: 'LOW', color: 'text-green-600 dark:text-green-400' }

  const stats = [
    {
      icon: <Brain className="w-4 h-4 text-purple-500" />,
      label: 'ETA',
      value: eta ? `${Number(eta.value).toFixed(1)} h` : '—',
      sub: eta?.modelName || 'delivery_eta',
      latency: eta?.latencyMs,
      fallback: eta?.fallback,
    },
    {
      icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
      label: 'Delay Risk',
      value: delayValue !== null ? `${delayValue.toFixed(1)}%` : '—',
      sub: delayRiskLevel ? <span className={delayRiskLevel.color}>{delayRiskLevel.label}</span> : '—',
      latency: delay?.latencyMs,
      fallback: delay?.fallback,
    },
    {
      icon: <Fuel className="w-4 h-4 text-blue-500" />,
      label: 'Fuel',
      value: fuel ? `${Number(fuel.value).toFixed(1)} L` : '—',
      sub: fuel?.modelName || 'fuel_estimation',
      latency: fuel?.latencyMs,
      fallback: fuel?.fallback,
    },
    {
      icon: <Wind className="w-4 h-4 text-green-500" />,
      label: 'CO₂',
      value: co2 ? `${Number(co2.value).toFixed(1)} kg` : '—',
      sub: 'derived',
      latency: null,
      fallback: false,
    },
    {
      icon: <Ruler className="w-4 h-4 text-indigo-500" />,
      label: 'Distance',
      value: booking?.distanceKm ? `${Number(booking.distanceKm).toFixed(1)} km` : '—',
      sub: 'route calc',
      latency: null,
      fallback: false,
    },
  ]

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">ML Predictions</h3>
        </div>
        <Button size="sm" variant="secondary" onClick={onRefresh} loading={isRefreshing}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {predictions.length === 0 && !isRefreshing ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-3">No predictions yet.</p>
          <Button size="sm" onClick={onRefresh} loading={isRefreshing}>Generate Predictions</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <div className="flex items-center gap-2">
                {s.icon}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.value}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{s.sub}</p>
                {s.latency && <p className="text-xs text-gray-400">{s.latency}ms</p>}
                {s.fallback && <p className="text-xs text-amber-500">heuristic</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showProof, setShowProof] = useState(false)
  const [statusNotes, setStatusNotes] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsService.getById(id),
    staleTime: 30 * 1000,
  })

  useBookingSocket(id, (update) => {
    toast(`Booking status updated: ${update.status}`, { icon: '📦' })
    refetch()
  })

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }) => bookingsService.updateStatus(id, status, notes),
    onSuccess: () => {
      toast.success('Status updated!')
      qc.invalidateQueries({ queryKey: ['bookings', id] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['shipments'] })
      qc.invalidateQueries({ queryKey: ['tracking'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['analytics-full'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const refreshPredictionsMutation = useMutation({
    mutationFn: () => mlService.predictBooking(id),
    onSuccess: () => {
      toast.success('Predictions refreshed!')
      qc.invalidateQueries({ queryKey: ['bookings', id] })
    },
    onError: () => toast.error('Failed to refresh — is the ML service running?'),
  })

  const { data: trackingData } = useQuery({
    queryKey: ['tracking', id],
    queryFn: () => trackingService.getHistory(id),
    staleTime: 60 * 1000,
  })

  const booking = normalizeBooking(data?.booking || data?.data || {})
  if (isLoading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>
  if (!booking?.id) return <div className="text-center py-16"><p className="text-gray-500">Booking not found</p></div>

  const transitions = STATUS_TRANSITIONS[user?.role]?.[booking.status] || []
  const tracking = (trackingData?.trackingLogs || trackingData?.tracking || trackingData?.data || []).map(normalizeTrackingLog)

  return (
    <div>
      <button onClick={() => navigate('/bookings')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Bookings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Booking #{booking.id?.slice(-8)}
                </h1>
                <p className="text-sm text-gray-500">Created {formatRelative(booking.createdAt)}</p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-gray-500 text-xs">Shipment Route</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {booking.shipment?.origin} → {booking.shipment?.destinationLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-green-500 shrink-0" />
                  <div>
                    <p className="text-gray-500 text-xs">Truck</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {booking.truck?.registrationNumber} ({booking.truck?.truckType?.replace(/_/g, ' ')})
                    </p>
                  </div>
                </div>
                {booking.totalAmount && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-purple-500 shrink-0" />
                    <div>
                      <p className="text-gray-500 text-xs">Total Amount</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(booking.totalAmount)}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Weight', value: formatWeight(booking.shipment?.weightKg) },
                  { label: 'Cargo Type', value: booking.shipment?.cargoType },
                  { label: 'Pickup', value: formatDate(booking.pickupDate) },
                  { label: 'Delivery', value: formatDate(booking.deliveryDate) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {booking.notes && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{booking.notes}</p>
              </div>
            )}
          </Card>

          {transitions.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Update Status</Card.Title>
              </Card.Header>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {transitions.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={['REJECTED', 'CANCELLED'].includes(status) ? 'danger' : 'primary'}
                      onClick={() => {
                        if (['REJECTED', 'CANCELLED'].includes(status)) {
                          if (!confirm(`Mark as ${status}?`)) return
                        }
                        statusMutation.mutate({ status, notes: statusNotes })
                      }}
                      loading={statusMutation.isPending}
                    >
                      → {status.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {tracking.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Tracking History</Card.Title>
              </Card.Header>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tracking.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-white">{t.status}</span>
                      <span className="text-gray-500 mx-2">•</span>
                      <span className="text-gray-500">{t.lat?.toFixed(4)}, {t.lng?.toFixed(4)}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatRelative(t.timestamp || t.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Title className="mb-4">Booking Progress</Card.Title>
            <StatusTimeline status={booking.status} />
          </Card>

          <MLPredictionsPanel
            booking={booking}
            onRefresh={() => refreshPredictionsMutation.mutate()}
            isRefreshing={refreshPredictionsMutation.isPending}
          />

          {booking.invoice && (
            <Card>
              <Card.Header>
                <Card.Title>Invoice</Card.Title>
              </Card.Header>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice #</span>
                  <span className="font-medium text-gray-900 dark:text-white">{booking.invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">{formatCurrency(booking.invoice.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <StatusBadge status={booking.invoice.status} size="sm" />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Due</span>
                  <span>{formatDate(booking.invoice.dueDate)}</span>
                </div>
              </div>
            </Card>
          )}

          {user?.role === 'DEALER' && booking.status === 'DELIVERED' && (
            <Button onClick={() => setShowProof(true)} variant="secondary" className="w-full">
              <Upload className="w-4 h-4 mr-2" /> Upload Proof of Delivery
            </Button>
          )}
        </div>
      </div>

      <Modal isOpen={showProof} onClose={() => setShowProof(false)} title="Upload Proof of Delivery">
        <ProofUploadModal booking={booking} onClose={() => setShowProof(false)} />
      </Modal>
    </div>
  )
}
