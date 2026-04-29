import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Package, MapPin, Clock, Truck, Brain, Zap,
  AlertTriangle, CheckCircle, XCircle, Star
} from 'lucide-react'
import toast from 'react-hot-toast'
import { shipmentsService } from '@/services/shipments.service'
import { bookingsService } from '@/services/bookings.service'
import { trucksService } from '@/services/trucks.service'
import { useAuthStore } from '@/store/authStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/shared/StatusBadge'
import Select from '@/components/ui/Select'
import { SkeletonCard } from '@/components/ui/Skeleton'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatDate, formatDateTime, formatWeight, formatVolume, formatCurrency, formatDistance } from '@/utils/formatters'
import { normalizeBooking, normalizePrediction, normalizeShipment, normalizeTruck } from '@/utils/normalizers'

function MLPredictionsPanel({ shipment }) {
  const predictions = (shipment?.predictions || []).map(normalizePrediction)
  const latest = predictions[0] || {}

  return (
    <Card>
      <Card.Header>
        <Card.Title><Brain className="inline w-4 h-4 mr-2 text-purple-500" />ML Predictions</Card.Title>
        {latest.fallback && (
          <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">Heuristic</span>
        )}
      </Card.Header>
      {predictions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No predictions available. Run optimization to generate.</p>
      ) : (
        <div className="space-y-3">
          {predictions.map((p, i) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">{p.predictionType?.replace(/_/g, ' ')}</span>
                {p.confidence && <span className="text-xs text-blue-600 dark:text-blue-400">{Math.round(p.confidence * 100)}% confidence</span>}
              </div>
              <p className="text-sm text-gray-900 dark:text-white font-semibold">
                {p.predictionType === 'ETA_HOURS' ? `${p.result?.estimated_hours?.toFixed(1) || '—'} hours` :
                 p.predictionType === 'DELAY_RISK_PERCENT' ? p.result?.risk_level || `${Math.round(p.result?.delay_probability || 0)}%` :
                 p.predictionType === 'FUEL_ESTIMATE_LITERS' ? `${p.result?.fuel_liters?.toFixed(1) || '—'} L` :
                 p.predictionType === 'CO2_KG' ? `${p.result?.co2_kg?.toFixed(1) || '—'} kg CO2` :
                 p.predictionType === 'RECOMMENDED_TRUCK_SCORE' ? `Top score ${p.result?.score ?? '—'}` :
                 JSON.stringify(p.result).slice(0, 80)}
              </p>
              {p.confidence && <ProgressBar value={p.confidence * 100} size="sm" color="blue" className="mt-1.5" />}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function OptimizePanel({ shipmentId, onClose }) {
  const [trucks, setTrucks] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedTruck, setSelectedTruck] = useState(null)
  const qc = useQueryClient()

  const runOptimize = async () => {
    setLoading(true)
    try {
      const res = await shipmentsService.optimize(shipmentId)
      setTrucks((res.results?.results || res.data?.results?.results || []).map(normalizeTruck))
      toast.success('Optimization complete!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Optimization failed')
    } finally { setLoading(false) }
  }

  const bookMutation = useMutation({
    mutationFn: (truckId) => bookingsService.create({ shipmentId, truckId }),
    onSuccess: () => {
      toast.success('Booking created!')
      qc.invalidateQueries({ queryKey: ['shipments'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['analytics-full'] })
      qc.invalidateQueries({ queryKey: ['trucks'] })
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Booking failed'),
  })

  return (
    <div className="space-y-4">
      {!trucks ? (
        <div className="text-center py-6">
          <Zap className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Run the AI optimization engine to find the best trucks for this shipment.
          </p>
          <Button onClick={runOptimize} loading={loading}>
            <Zap className="w-4 h-4 mr-1" /> Run Optimization
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {trucks.length} trucks ranked by AI score. Select one to book.
          </p>
          {trucks.map((t, i) => {
            const score = t.score || t.optimizationScore || 0
            return (
              <div
                key={t.id || t.truckId || i}
                onClick={() => setSelectedTruck(t.id || t.truckId)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedTruck === (t.id || t.truckId)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {i === 0 && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{t.registrationNumber}</p>
                    </div>
                    <p className="text-xs text-gray-500">{t.truckType} • {t.capacityWeight}kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{Math.round(score * 100) / 100}</p>
                    <p className="text-xs text-gray-500">AI Score</p>
                  </div>
                </div>
                <ProgressBar value={score} max={100} color="blue" size="sm" className="mt-2" />
              </div>
            )
          })}

          {selectedTruck && (
            <Button
              onClick={() => bookMutation.mutate(selectedTruck)}
              loading={bookMutation.isPending}
              className="w-full"
            >
              Book Selected Truck
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ShipmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showOptimize, setShowOptimize] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [selectedTruckId, setSelectedTruckId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['shipments', id],
    queryFn: () => shipmentsService.getById(id),
    staleTime: 30 * 1000,
  })

  const { data: trucksData } = useQuery({
    queryKey: ['trucks', 'available'],
    queryFn: () => trucksService.getAvailable(),
    enabled: showBooking,
  })

  const shipment = normalizeShipment(data?.shipment || data?.data || {})

  const cancelMutation = useMutation({
    mutationFn: () => shipmentsService.cancel(id),
    onSuccess: () => {
      toast.success('Shipment cancelled')
      qc.invalidateQueries({ queryKey: ['shipments'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Cancel failed'),
  })

  const createBookingMutation = useMutation({
    mutationFn: (truckId) => bookingsService.create({ shipmentId: id, truckId }),
    onSuccess: () => {
      toast.success('Booking created!')
      qc.invalidateQueries({ queryKey: ['shipments', id] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['analytics-full'] })
      qc.invalidateQueries({ queryKey: ['trucks'] })
      setShowBooking(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Booking failed'),
  })

  if (isLoading) return (
    <div className="space-y-4">
      <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
    </div>
  )

  if (!shipment?.id) return (
    <div className="text-center py-16">
      <p className="text-gray-500">Shipment not found</p>
      <Button onClick={() => navigate('/shipments')} variant="ghost" className="mt-4">Back to Shipments</Button>
    </div>
  )

  const bookings = (shipment.bookings || []).map(normalizeBooking)
  const canCancel = ['PENDING', 'OPTIMIZED'].includes(shipment.status) && user?.role === 'WAREHOUSE'
  const canBook = shipment.status === 'OPTIMIZED' && user?.role === 'WAREHOUSE'
  const canOptimize = shipment.status === 'PENDING' && user?.role === 'WAREHOUSE'

  const availableTrucks = (trucksData?.trucks || trucksData?.data || []).map(normalizeTruck).map((t) => ({
    value: t.id,
    label: `${t.registrationNumber} — ${t.truckType} (${t.capacityWeight}kg)`,
  }))

  return (
    <div>
      <button onClick={() => navigate('/shipments')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Shipments
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Package className="w-6 h-6 text-blue-600" />
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {shipment.origin} → {shipment.destinationLabel}
                  </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">ID: {shipment.id}</p>
              </div>
              <StatusBadge status={shipment.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Weight', value: formatWeight(shipment.weightKg) },
                { label: 'Volume', value: formatVolume(shipment.volumeM3) },
                { label: 'Cargo Type', value: shipment.cargoType },
                { label: 'Priority', value: shipment.priority },
                { label: 'Deadline', value: formatDate(shipment.deadline) },
                { label: 'Created', value: formatDate(shipment.createdAt) },
                { label: 'Distance', value: bookings[0]?.distanceKm ? formatDistance(bookings[0].distanceKm) : '—' },
                { label: 'Description', value: shipment.description || '—' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            {shipment.specialInstructions && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Special Instructions</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{shipment.specialInstructions}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              {canOptimize && (
                <Button onClick={() => setShowOptimize(true)} size="sm">
                  <Zap className="w-4 h-4 mr-1" /> Optimize
                </Button>
              )}
              {canBook && (
                <Button onClick={() => setShowBooking(true)} size="sm" variant="secondary">
                  <Truck className="w-4 h-4 mr-1" /> Book Truck
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm" variant="danger"
                  onClick={() => {
                    if (confirm('Cancel this shipment?')) cancelMutation.mutate()
                  }}
                  loading={cancelMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </div>
          </Card>

          {bookings.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Booking History</Card.Title>
              </Card.Header>
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => navigate(`/bookings/${b.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {b.truck?.registrationNumber || 'Unknown Truck'}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(b.createdAt)}</p>
                    </div>
                    <StatusBadge status={b.status} size="sm" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <MLPredictionsPanel shipment={shipment} />

          {(shipment.originLat || shipment.destinationLat) && (
            <Card>
              <Card.Header>
                <Card.Title><MapPin className="inline w-4 h-4 mr-1 text-red-500" />Route</Card.Title>
              </Card.Header>
              <div className="space-y-2 text-sm">
                {shipment.originLat && (
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">From:</span> {shipment.originLat.toFixed(4)}, {shipment.originLng?.toFixed(4)}
                  </p>
                )}
                {shipment.destinationLat && (
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">To:</span> {shipment.destinationLat.toFixed(4)}, {shipment.destinationLng?.toFixed(4)}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal isOpen={showOptimize} onClose={() => setShowOptimize(false)} title="AI Optimization Engine" size="lg">
        <OptimizePanel shipmentId={id} onClose={() => setShowOptimize(false)} />
      </Modal>

      <Modal isOpen={showBooking} onClose={() => setShowBooking(false)} title="Book a Truck" size="md">
        <div className="space-y-4">
          <Select
            label="Select Truck"
            value={selectedTruckId}
            onChange={(e) => setSelectedTruckId(e.target.value)}
            options={availableTrucks}
            placeholder="Choose available truck..."
          />
          <div className="flex gap-3">
            <Button
              onClick={() => createBookingMutation.mutate(selectedTruckId)}
              disabled={!selectedTruckId}
              loading={createBookingMutation.isPending}
              className="flex-1"
            >
              Create Booking
            </Button>
            <Button variant="secondary" onClick={() => setShowBooking(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
