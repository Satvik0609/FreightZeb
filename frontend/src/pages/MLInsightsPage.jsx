import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Brain, Truck, Clock, AlertTriangle, Fuel, MapPin, Package,
  Zap, ChevronRight, Info, Star, BarChart2, Layers
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { mlService } from '@/services/ml.service'
import { shipmentsService } from '@/services/shipments.service'
import { trucksService } from '@/services/trucks.service'
import { bookingsService } from '@/services/bookings.service'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import PageHeader from '@/components/layout/PageHeader'
import ProgressBar from '@/components/ui/ProgressBar'
import Gauge from '@/components/ui/Gauge'
import Skeleton from '@/components/ui/Skeleton'
import Tabs from '@/components/ui/Tabs'
import { formatCurrency, formatDate } from '@/utils/formatters'
import {
  TRUCK_TYPES, CARGO_TYPES, PRIORITY_OPTIONS,
  WEATHER_OPTIONS, TRAFFIC_OPTIONS, TIME_OF_DAY_OPTIONS
} from '@/utils/constants'
import { useAuthStore } from '@/store/authStore'
import { haversineKm, normalizeShipment, normalizeTruck } from '@/utils/normalizers'

function DealerRidePredictions({ bookings }) {
  const [refreshingBookingId, setRefreshingBookingId] = useState(null)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const mutation = useMutation({
    mutationFn: (bookingId) => mlService.predictBooking(bookingId),
    onSettled: () => setRefreshingBookingId(null),
  })

  const activeBookings = bookings.filter((booking) =>
    ['APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(booking.status)
  )

  const latestPrediction = (predictions, type) => predictions?.find((prediction) => prediction.type === type)

  const handleRefreshAll = async () => {
    if (activeBookings.length === 0) return
    setRefreshingAll(true)
    try {
      await mlService.predictBookingsBatch(activeBookings.map((b) => b.id))
    } finally {
      setRefreshingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="xs" variant="secondary" loading={refreshingAll} onClick={handleRefreshAll}>
          Refresh All Active
        </Button>
      </div>
      {activeBookings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No active/dealt rides yet. Predictions will auto-generate when you accept rides and add trucks.
        </p>
      ) : activeBookings.map((booking) => {
        const predictions = booking.shipment?.predictions || []
        const eta = latestPrediction(predictions, 'ETA_HOURS')
        const delay = latestPrediction(predictions, 'DELAY_RISK_PERCENT')
        const fuel = latestPrediction(predictions, 'FUEL_ESTIMATE_LITERS')
        const co2 = latestPrediction(predictions, 'CO2_KG')

        return (
          <div key={booking.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="font-medium text-gray-900 dark:text-white">
                {booking.truck?.registrationNo || booking.truck?.registrationNumber || 'Truck'} - Booking #{booking.id.slice(-8)}
              </p>
              <Button
                size="xs"
                variant="secondary"
                loading={refreshingBookingId === booking.id && mutation.isPending}
                onClick={() => {
                  setRefreshingBookingId(booking.id)
                  mutation.mutate(booking.id)
                }}
              >
                Refresh Predictions
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500">ETA</p>
                <p className="font-semibold text-gray-900 dark:text-white">{eta ? `${Number(eta.value).toFixed(1)} h` : '—'}</p>
                {eta?.modelName && <p className="text-[11px] text-gray-500">{eta.modelName} {eta.fallback ? '(heuristic)' : ''}</p>}
              </div>
              <div>
                <p className="text-gray-500">Delay Risk</p>
                <p className="font-semibold text-gray-900 dark:text-white">{delay ? `${Number(delay.value).toFixed(1)}%` : '—'}</p>
                {delay?.confidence != null && <p className="text-[11px] text-gray-500">conf {Math.round(delay.confidence * 100)}%</p>}
              </div>
              <div>
                <p className="text-gray-500">Fuel</p>
                <p className="font-semibold text-gray-900 dark:text-white">{fuel ? `${Number(fuel.value).toFixed(1)} L` : '—'}</p>
                {fuel?.latencyMs != null && <p className="text-[11px] text-gray-500">{fuel.latencyMs}ms</p>}
              </div>
              <div>
                <p className="text-gray-500">CO₂</p>
                <p className="font-semibold text-gray-900 dark:text-white">{co2 ? `${Number(co2.value).toFixed(1)} kg` : '—'}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FallbackBadge({ fallback }) {
  if (!fallback) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
      <Info className="w-3 h-3" /> Heuristic
    </span>
  )
}

function ModelBadge({ accuracy }) {
  if (!accuracy) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
      <Star className="w-3 h-3" /> {Math.round(accuracy * 100)}% accuracy
    </span>
  )
}

function TruckRecommender({ shipments }) {
  const [form, setForm] = useState({ weight_kg: '', volume_m3: '', distance_km: '', cargo_type: 'GENERAL', priority: 'NORMAL' })
  const [selectedShipmentId, setSelectedShipmentId] = useState('')
  const [result, setResult] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const selectedShipment = shipments.find((shipment) => shipment.id === selectedShipmentId)

  const mutation = useMutation({
    mutationFn: () => mlService.recommendTruck(form),
    onSuccess: (data) => setResult(data),
  })

  const rec = result?.result || result?.recommendation || result?.data
  const alternatives = rec?.alternatives || result?.alternatives || result?.data?.alternatives || []
  const onShipmentSelect = (event) => {
    const shipmentId = event.target.value
    setSelectedShipmentId(shipmentId)

    const shipment = shipments.find((item) => item.id === shipmentId)
    if (!shipment) return

    const distanceKm = haversineKm(
      shipment.pickupLocation?.lat ?? shipment.originLat,
      shipment.pickupLocation?.lng ?? shipment.originLng,
      shipment.destination?.lat ?? shipment.destinationLat,
      shipment.destination?.lng ?? shipment.destinationLng
    )

    setForm((prev) => ({
      ...prev,
      weight_kg: shipment.weightKg ?? prev.weight_kg,
      volume_m3: shipment.volumeM3 ?? prev.volume_m3,
      distance_km: distanceKm ?? prev.distance_km,
      cargo_type: shipment.cargoType ?? prev.cargo_type,
      priority: shipment.priority ?? prev.priority,
    }))
  }

  return (
    <div className="space-y-6">
      <Select
        label="Load from Shipment (Optional)"
        value={selectedShipmentId}
        onChange={onShipmentSelect}
        options={shipments.map((s) => ({ value: s.id, label: `${s.origin} → ${s.destinationLabel}` }))}
        placeholder="Select shipment to auto-fill..."
      />
      {selectedShipment && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
          Auto-loaded from shipment `{selectedShipment.origin} → {selectedShipment.destinationLabel}`
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Input label="Weight (kg)" type="number" value={form.weight_kg} onChange={set('weight_kg')} placeholder="1000" required />
        <Input label="Volume (m³)" type="number" value={form.volume_m3} onChange={set('volume_m3')} placeholder="5" />
        <Input label="Distance (km)" type="number" value={form.distance_km} onChange={set('distance_km')} placeholder="500" required />
        <Select label="Cargo Type" value={form.cargo_type} onChange={set('cargo_type')} options={CARGO_TYPES} />
        <Select label="Priority" value={form.priority} onChange={set('priority')} options={PRIORITY_OPTIONS} />
      </div>
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.weight_kg || !form.distance_km}>
        <Brain className="w-4 h-4 mr-1" /> Get Recommendation
      </Button>

      {mutation.isPending && <Skeleton lines={3} height="h-16" />}

      {rec && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">Recommended Truck</h4>
            <FallbackBadge fallback={result?.fallback} />
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-blue-900 dark:text-blue-100">{(rec.recommended_truck || rec.recommended_type || rec.truckType || '—').replace(/_/g, ' ')}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Best match for your shipment</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((rec.confidence || rec.score || 0) * 100)}%
                </p>
                <p className="text-xs text-blue-500">Confidence</p>
              </div>
            </div>
            <ProgressBar value={(rec.confidence || rec.score || 0) * 100} color="blue" size="md" />
            {rec.reasoning && <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">{rec.reasoning}</p>}
          </div>

          {alternatives.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alternatives</p>
              <div className="space-y-2">
                {alternatives.map((alt, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-400 text-sm w-4">#{i + 2}</span>
                    <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {(alt.truck_type || alt.type || '').replace(/_/g, ' ')}
                    </span>
                    <div className="w-32">
                      <ProgressBar value={(alt.confidence || alt.score || 0) * 100} size="sm" color="indigo" />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {Math.round((alt.confidence || alt.score || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeliveryPredictor({ shipments }) {
  const [form, setForm] = useState({ shipmentId: '', traffic: 'MODERATE', weather: 'CLEAR' })
  const [result, setResult] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const selectedShipment = shipments.find((shipment) => shipment.id === form.shipmentId)
  const distanceKm = selectedShipment
    ? haversineKm(
      selectedShipment.pickupLocation?.lat ?? selectedShipment.originLat,
      selectedShipment.pickupLocation?.lng ?? selectedShipment.originLng,
      selectedShipment.destination?.lat ?? selectedShipment.destinationLat,
      selectedShipment.destination?.lng ?? selectedShipment.destinationLng
    )
    : null

  const mutation = useMutation({
    mutationFn: () =>
      mlService.predictDelivery(form.shipmentId, {
        traffic: form.traffic,
        weather: form.weather,
        distance_km: distanceKm ?? undefined,
      }),
    onSuccess: (data) => setResult(data),
  })

  const pred = result?.result || result?.prediction || result?.data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          label="Shipment"
          value={form.shipmentId}
          onChange={set('shipmentId')}
          options={shipments.map((s) => ({ value: s.id, label: `${s.origin} → ${s.destinationLabel}` }))}
          placeholder="Select shipment..."
          className="col-span-full sm:col-span-1"
        />
        <Select label="Traffic" value={form.traffic} onChange={set('traffic')} options={TRAFFIC_OPTIONS} />
        <Select label="Weather" value={form.weather} onChange={set('weather')} options={WEATHER_OPTIONS} />
      </div>
      {distanceKm !== null && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Auto-computed distance: <span className="font-medium">{distanceKm} km</span>
        </p>
      )}
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.shipmentId}>
        <Clock className="w-4 h-4 mr-1" /> Predict Delivery Time
      </Button>

      {mutation.isPending && <Skeleton lines={2} height="h-20" />}

      {pred && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-semibold text-gray-900 dark:text-white">Delivery Prediction</h4>
            <FallbackBadge fallback={result?.fallback} />
            <ModelBadge accuracy={result?.model_accuracy} />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-bold text-green-600 dark:text-green-400">
              {(pred.predicted_hours || pred.estimated_hours || pred.estimatedHours || 0).toFixed(1)}
            </span>
            <span className="text-green-600 dark:text-green-400 mb-1">hours</span>
          </div>
          {(pred.min_hours || pred.minHours) && (
            <p className="text-xs text-gray-500 mb-3">
              Range: {pred.min_hours || pred.minHours}h — {pred.max_hours || pred.maxHours}h
            </p>
          )}
          <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, ((pred.predicted_hours || pred.estimated_hours || pred.estimatedHours || 0) / 72) * 100)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
              ETA Visualization
            </div>
          </div>
          {pred.factors && (
            <div className="mt-3 space-y-1">
              {Object.entries(pred.factors).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{typeof v === 'number' ? v.toFixed(2) : v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DelayRiskAnalyzer({ shipments }) {
  const [form, setForm] = useState({ shipmentId: '', weather: 'CLEAR', traffic: 'MODERATE', time_of_day: 'MORNING' })
  const [result, setResult] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const selectedShipment = shipments.find((shipment) => shipment.id === form.shipmentId)
  const distanceKm = selectedShipment
    ? haversineKm(
      selectedShipment.pickupLocation?.lat ?? selectedShipment.originLat,
      selectedShipment.pickupLocation?.lng ?? selectedShipment.originLng,
      selectedShipment.destination?.lat ?? selectedShipment.destinationLat,
      selectedShipment.destination?.lng ?? selectedShipment.destinationLng
    )
    : null

  const mutation = useMutation({
    mutationFn: () =>
      mlService.predictDelay(form.shipmentId, {
        weather: form.weather,
        traffic: form.traffic,
        time_of_day: form.time_of_day,
        distance_km: distanceKm ?? undefined,
      }),
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  })

  const pred = result?.result || result?.prediction || result?.data
  const riskLevel = pred?.risk_level || pred?.riskLevel || 'UNKNOWN'

  // delay_probability is now a true calibrated probability (0–100) from predict_proba()[1]*100
  const delayProbability = Number.isFinite(Number(pred?.delay_probability))
    ? Number(pred.delay_probability)
    : 0

  // feature_contributions: { distance, weight, truck_type, weather, traffic, time_of_day }
  // Values are already 0–100 scale percentage contributions.
  const featureContributions = pred?.feature_contributions || null
  const contributionEntries = featureContributions
    ? Object.entries(featureContributions)
        .map(([key, value]) => ({ key, percent: Math.max(0, Math.min(100, Number(value) || 0)) }))
        .sort((a, b) => b.percent - a.percent)
    : []

  const riskBadgeColor = {
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    MODERATE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }

  const modelDetails = pred?.model_details

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Select label="Shipment" value={form.shipmentId} onChange={set('shipmentId')} options={shipments.map((s) => ({ value: s.id, label: `${s.origin} → ${s.destinationLabel}` }))} placeholder="Select..." className="col-span-full sm:col-span-1" />
        <Select label="Weather" value={form.weather} onChange={set('weather')} options={WEATHER_OPTIONS} />
        <Select label="Traffic" value={form.traffic} onChange={set('traffic')} options={TRAFFIC_OPTIONS} />
        <Select label="Time of Day" value={form.time_of_day} onChange={set('time_of_day')} options={TIME_OF_DAY_OPTIONS} />
      </div>
      {distanceKm !== null && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Auto-computed distance: <span className="font-medium">{distanceKm} km</span>
        </p>
      )}
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.shipmentId}>
        <AlertTriangle className="w-4 h-4 mr-1" /> Analyze Delay Risk
      </Button>

      {mutation.isPending && <Skeleton lines={2} height="h-20" />}

      {mutation.isError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">
            ML service unavailable. Make sure the ML service is running on port 8000.
          </p>
        </div>
      )}

      {pred && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Gauge + risk level */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-4 self-start">
                <h4 className="font-semibold text-gray-900 dark:text-white">Risk Level</h4>
                <FallbackBadge fallback={result?.fallback} />
              </div>
              <Gauge
                value={Math.max(0, Math.min(100, delayProbability))}
                max={100}
                size={160}
                label={riskLevel}
                colorThresholds={[
                  { threshold: 25, color: '#22c55e' },
                  { threshold: 50, color: '#f59e0b' },
                  { threshold: 75, color: '#f97316' },
                  { threshold: 100, color: '#ef4444' },
                ]}
              />
              <p className="text-sm text-gray-500 mt-2">
                Delay Probability: <strong>{Math.round(delayProbability)}%</strong>
              </p>
              <span className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold ${riskBadgeColor[riskLevel] || 'bg-gray-100 text-gray-700'}`}>
                {riskLevel}
              </span>
            </div>

            {/* Right: Feature contribution breakdown */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Risk Factor Contributions</h4>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Based on LR coefficient × feature value — each bar shows how much that factor contributes to the delay probability.
              </p>
              {contributionEntries.length > 0
                ? contributionEntries.map(({ key, percent }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{percent.toFixed(1)}%</span>
                    </div>
                    <ProgressBar
                      value={percent}
                      size="sm"
                      color={percent > 20 ? 'red' : percent > 8 ? 'amber' : 'green'}
                    />
                  </div>
                ))
                : (
                  <p className="text-xs text-gray-500">No contribution data available.</p>
                )
              }

              {pred.recommendations && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Recommendation</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{pred.recommendations}</p>
                </div>
              )}
            </div>
          </div>

          {/* Model detail row */}
          {modelDetails && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Model: <strong className="text-gray-700 dark:text-gray-300">{modelDetails.model_type}</strong></span>
              <span>LR: <strong>{modelDetails.lr_probability}%</strong></span>
              <span>GBM: <strong>{modelDetails.gbm_probability}%</strong></span>
              <span>AUC: <strong>{modelDetails.roc_auc}</strong></span>
              <span>Brier: <strong>{modelDetails.brier_score}</strong></span>
              <span>Accuracy: <strong>{(modelDetails.accuracy * 100).toFixed(1)}%</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FuelEstimator({ shipments, trucks }) {
  const [form, setForm] = useState({ distance_km: '', weight_kg: '', truck_type: 'CONTAINER_20FT' })
  const [selectedShipmentId, setSelectedShipmentId] = useState('')
  const [result, setResult] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: () => mlService.estimateFuel(form),
    onSuccess: (data) => setResult(data),
  })

  const est = result?.result || result?.estimate || result?.data
  const liters = Number(est?.estimated_liters ?? est?.fuel_liters ?? est?.fuelLiters ?? 0)
  const costInr = Number(est?.estimated_cost_inr ?? est?.estimated_cost ?? est?.cost_inr ?? est?.costInr ?? est?.cost ?? 0)
  const co2Reported = Number(est?.co2_kg ?? est?.co2_emissions_kg ?? est?.co2Kg ?? 0)
  // Never display impossible 0 kg when fuel > 0; use standard diesel CO2 factor as UI fallback.
  const co2Kg = liters > 0 && co2Reported <= 0 ? Number((liters * 2.68).toFixed(2)) : co2Reported
  const onShipmentSelect = (event) => {
    const shipmentId = event.target.value
    setSelectedShipmentId(shipmentId)

    const shipment = shipments.find((item) => item.id === shipmentId)
    if (!shipment) return

    const distanceKm = haversineKm(
      shipment.pickupLocation?.lat ?? shipment.originLat,
      shipment.pickupLocation?.lng ?? shipment.originLng,
      shipment.destination?.lat ?? shipment.destinationLat,
      shipment.destination?.lng ?? shipment.destinationLng
    )

    setForm((prev) => ({
      ...prev,
      distance_km: distanceKm ?? prev.distance_km,
      weight_kg: shipment.weightKg ?? prev.weight_kg,
    }))
  }
  const truckTypeOptions = trucks.length > 0
    ? trucks.map((truck) => ({
      value: truck.truckType,
      label: `${truck.registrationNumber} - ${truck.truckType?.replace(/_/g, ' ') || 'Unknown'}`,
    }))
    : TRUCK_TYPES

  return (
    <div className="space-y-4">
      <Select
        label="Load from Shipment (Optional)"
        value={selectedShipmentId}
        onChange={onShipmentSelect}
        options={shipments.map((s) => ({ value: s.id, label: `${s.origin} → ${s.destinationLabel}` }))}
        placeholder="Select shipment to auto-fill..."
      />
      <div className="grid grid-cols-3 gap-4">
        <Input label="Distance (km)" type="number" value={form.distance_km} onChange={set('distance_km')} placeholder="500" required />
        <Input label="Weight (kg)" type="number" value={form.weight_kg} onChange={set('weight_kg')} placeholder="1000" />
        <Select label="Truck Type" value={form.truck_type} onChange={set('truck_type')} options={truckTypeOptions} />
      </div>
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.distance_km}>
        <Fuel className="w-4 h-4 mr-1" /> Estimate Fuel
      </Button>

      {mutation.isPending && <Skeleton lines={2} height="h-20" />}

      {est && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Fuel Required', value: `${liters.toFixed(1)} L`, icon: Fuel, color: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
            { label: 'Estimated Cost', value: formatCurrency(costInr), icon: BarChart2, color: 'green', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' },
            { label: 'CO₂ Emissions', value: `${co2Kg.toFixed(1)} kg`, icon: Zap, color: 'amber', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' },
          ].map((item) => (
            <div key={item.label} className={`p-4 rounded-xl border ${item.bg} flex items-center gap-3`}>
              <item.icon className={`w-8 h-8 text-${item.color}-600 dark:text-${item.color}-400 shrink-0`} />
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{item.value}</p>
              </div>
            </div>
          ))}
          {est.efficiency && (
            <div className="sm:col-span-3 mt-2">
              <p className="text-xs text-gray-500 mb-1">Fuel Efficiency</p>
              <ProgressBar
                value={Math.min(100, (est.efficiency / 20) * 100)}
                size="md"
                color="green"
                label={`${est.efficiency.toFixed(2)} km/L`}
                showValue={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ShipmentCluster() {
  const [result, setResult] = useState(null)

  const mutation = useMutation({
    mutationFn: () => mlService.clusterShipments('PENDING'),
    onSuccess: (data) => setResult(data),
  })

  const clusters = result?.result?.clusters || result?.clusters || result?.data?.clusters || []
  const CLUSTER_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Cluster pending shipments by geographic proximity to optimize routing and consolidation.
      </p>
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
        <Layers className="w-4 h-4 mr-1" /> Cluster Pending Shipments
      </Button>

      {mutation.isPending && <Skeleton lines={3} height="h-12" />}

      {clusters.length > 0 && (
        <div className="space-y-4">
          <div className="h-72 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <MapContainer center={[20.5937, 78.9629]} zoom={5} className="w-full h-full" style={{ zIndex: 0 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              {clusters.map((cluster, ci) =>
                (cluster.shipments || []).map((s, si) => {
                  const lat = Number(s.latitude)
                  const lng = Number(s.longitude)
                  const shipmentId = s.id ?? s.shipment_index ?? s.shipmentIndex ?? '—'

                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

                  return (
                    <CircleMarker
                      key={`${ci}-${si}`}
                      center={[lat, lng]}
                      radius={10}
                      fillColor={CLUSTER_COLORS[ci % CLUSTER_COLORS.length]}
                      color="white"
                      weight={2}
                      fillOpacity={0.8}
                    >
                      <Popup>
                        <p className="text-xs font-medium">Cluster {ci + 1}</p>
                        <p className="text-xs">{shipmentId}</p>
                      </Popup>
                    </CircleMarker>
                  )
                })
              )}
            </MapContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusters.map((cluster, i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
                  <span className="font-medium text-sm text-gray-900 dark:text-white">Cluster {i + 1}</span>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>{cluster.count ?? cluster.shipments?.length ?? 0} shipments</p>
                  {cluster.totalWeight != null && <p>Total: {Number(cluster.totalWeight).toFixed(0)} kg</p>}
                  {cluster.center?.lat != null && cluster.center?.lng != null && (
                    <p>
                      Center: {Number(cluster.center.lat).toFixed(2)}, {Number(cluster.center.lng).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && clusters.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <MapPin className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">
            {result?.message || result?.result?.message || 'No pending shipments to cluster'}
          </p>
        </div>
      )}
    </div>
  )
}

function CargoOptimizer({ trucks }) {
  const [selectedTruckId, setSelectedTruckId] = useState('')
  const [truck, setTruck] = useState({ capacity_kg: '', capacity_m3: '' })
  const [items, setItems] = useState([{ name: '', weight_kg: '', volume_m3: '', priority: 1 }])
  const [result, setResult] = useState(null)

  const setTruckField = (k) => (e) => setTruck({ ...truck, [k]: e.target.value })
  const setItem = (i, k) => (e) => {
    const next = [...items]
    next[i] = { ...next[i], [k]: e.target.value }
    setItems(next)
  }
  const addItem = () => setItems([...items, { name: '', weight_kg: '', volume_m3: '', priority: 1 }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))

  const mutation = useMutation({
    mutationFn: () => mlService.optimizeCargo({
      truck_capacity_kg: Number(truck.capacity_kg),
      truck_capacity_m3: Number(truck.capacity_m3),
      items: items
        .filter((it) => it.name)
        .map((it) => ({
          name: it.name,
          weight_kg: Number(it.weight_kg),
          volume_m3: Number(it.volume_m3),
          priority: Number(it.priority || 1),
        })),
    }),
    onSuccess: (data) => setResult(data),
  })

  const opt = result?.result || result?.optimization || result?.data
  const fitted  = opt?.selected_items || opt?.fittedItems  || []
  const rejected = opt?.rejected_items || opt?.rejectedItems || []

  const statusMeta = {
    OPTIMAL:        { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  label: 'Optimal' },
    FEASIBLE:       { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  label: 'Feasible' },
    GREEDY_FALLBACK:{ color: 'bg-gray-100  text-gray-600  dark:bg-gray-700/40   dark:text-gray-300',  label: 'Greedy Fallback' },
    EMPTY:          { color: 'bg-gray-100  text-gray-500  dark:bg-gray-700/40   dark:text-gray-400',  label: 'No Items' },
  }
  const optStatus = opt?.optimization_status || 'FEASIBLE'
  const statusStyle = statusMeta[optStatus] || statusMeta.FEASIBLE

  const REASON_LABELS = {
    exceeds_truck_weight:      'Over weight limit',
    exceeds_truck_volume:      'Over volume limit',
    exceeds_truck_both:        'Over both limits',
    not_selected_by_optimizer: 'Lower priority',
    capacity_exceeded:         'Capacity full',
    over_weight:               'Over weight limit',
    over_volume:               'Over volume limit',
    over_weight_and_volume:    'Over both limits',
    lower_objective_priority:  'Lower priority',
  }
  const readableReason = (r) => r?.reason_label || REASON_LABELS[r?.reason] || (r?.reason || '—').replace(/_/g, ' ')

  const capKg = Number(truck.capacity_kg) || 0
  const capM3 = Number(truck.capacity_m3) || 0
  const weightUsed = opt?.weight_used ?? opt?.total_weight_kg ?? 0
  const volumeUsed = opt?.volume_used ?? opt?.total_volume_m3 ?? 0
  const remaining  = opt?.remaining_capacity || { weight_kg: capKg - weightUsed, volume_m3: capM3 - volumeUsed }

  const onTruckSelect = (event) => {
    const truckId = event.target.value
    setSelectedTruckId(truckId)
    const selectedTruck = trucks.find((item) => item.id === truckId)
    if (!selectedTruck) return

    setTruck((prev) => ({
      ...prev,
      capacity_kg: selectedTruck.capacityWeight ?? prev.capacity_kg,
      capacity_m3: selectedTruck.capacityVolume ?? prev.capacity_m3,
    }))
  }

  return (
    <div className="space-y-4">
      <Select
        label="Load from Truck (Optional)"
        value={selectedTruckId}
        onChange={onTruckSelect}
        options={trucks.map((truckItem) => ({
          value: truckItem.id,
          label: `${truckItem.registrationNumber} - ${(truckItem.truckType || '').replace(/_/g, ' ')} (${truckItem.capacityWeight || '—'} kg / ${truckItem.capacityVolume || '—'} m³)`,
        }))}
        placeholder="Select truck to auto-fill capacity..."
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Truck Capacity (kg)" type="number" value={truck.capacity_kg} onChange={setTruckField('capacity_kg')} placeholder="10000" required />
        <Input label="Truck Volume (m³)" type="number" value={truck.capacity_m3} onChange={setTruckField('capacity_m3')} placeholder="40" required />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</p>
          <Button size="xs" variant="secondary" onClick={addItem}>+ Add Item</Button>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input placeholder="Item name" value={item.name} onChange={setItem(i, 'name')} className="flex-1" />
              <Input placeholder="kg" type="number" value={item.weight_kg} onChange={setItem(i, 'weight_kg')} className="w-24" />
              <Input placeholder="m³" type="number" value={item.volume_m3} onChange={setItem(i, 'volume_m3')} className="w-24" />
              <Input placeholder="P" type="number" min="1" max="10" step="1" value={item.priority} onChange={setItem(i, 'priority')} className="w-20" />
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 mt-2.5 text-lg leading-none">×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!truck.capacity_kg || items.filter(i => i.name).length === 0}>
        <Package className="w-4 h-4 mr-1" /> Optimize Cargo
      </Button>

      {mutation.isPending && <Skeleton lines={2} height="h-16" />}

      {opt && (
        <div className="space-y-5">

          {/* ── Optimization Summary bar ── */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle.color}`}>
              {statusStyle.label}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-bold text-gray-900 dark:text-white">{fitted.length}</span>
              {' of '}
              <span className="font-bold text-gray-900 dark:text-white">{fitted.length + rejected.length}</span>
              {' items loaded'}
            </span>
            {remaining.weight_kg > 0 && (
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                Remaining capacity: <span className="font-medium text-gray-700 dark:text-gray-300">{Number(remaining.weight_kg).toFixed(0)} kg / {Number(remaining.volume_m3).toFixed(2)} m³</span>
              </span>
            )}
          </div>

          {/* ── Utilization KPI cards ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Weight Used',
                value: `${Number(weightUsed).toFixed(0)} kg`,
                pct: capKg > 0 ? (weightUsed / capKg) * 100 : 0,
              },
              {
                label: 'Volume Used',
                value: `${Number(volumeUsed).toFixed(2)} m³`,
                pct: capM3 > 0 ? (volumeUsed / capM3) * 100 : 0,
              },
              {
                label: 'Items Loaded',
                value: `${fitted.length} / ${fitted.length + rejected.length}`,
                pct: (fitted.length + rejected.length) > 0
                  ? (fitted.length / (fitted.length + rejected.length)) * 100
                  : 0,
              },
            ].map((card) => (
              <div key={card.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-0.5">{card.label}</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm mb-2">{card.value}</p>
                <ProgressBar value={card.pct} size="sm" color={card.pct > 90 ? 'red' : card.pct > 70 ? 'amber' : 'green'} showValue />
              </div>
            ))}
          </div>

          {/* ── Loaded Items table ── */}
          {fitted.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                ✓ Loaded Items ({fitted.length})
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['Item', 'Weight (kg)', 'Volume (m³)', 'Priority', '% of truck wt'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {fitted.map((it, i) => {
                      const wPct = capKg > 0 ? ((Number(it.weight_kg) / capKg) * 100).toFixed(1) : '—'
                      return (
                        <tr key={i} className="bg-white dark:bg-gray-900 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{it.name || `Item ${i + 1}`}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{Number(it.weight_kg).toFixed(1)}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{Number(it.volume_m3).toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              P{it.priority ?? 1}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{wPct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Rejected Items table ── */}
          {rejected.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                ✗ Not Loaded ({rejected.length})
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['Item', 'Weight (kg)', 'Volume (m³)', 'Rejection Reason'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rejected.map((it, i) => (
                      <tr key={i} className="bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{it.name || `Item ${i + 1}`}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{Number(it.weight_kg).toFixed(1)}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{Number(it.volume_m3).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            {readableReason(it)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default function MLInsightsPage() {
  const { user } = useAuthStore()
  const { data: shipmentsData } = useQuery({
    queryKey: ['shipments-for-ml'],
    queryFn: () => (user?.role === 'WAREHOUSE' ? shipmentsService.getMy() : { shipments: [] }),
    staleTime: 60 * 1000,
    enabled: !!user,
  })
  const { data: trucksData } = useQuery({
    queryKey: ['trucks-for-ml', user?.role],
    queryFn: () => {
      if (user?.role === 'DEALER') return trucksService.getMy()
      if (user?.role === 'ADMIN') return trucksService.getAll()
      return trucksService.getAvailable()
    },
    staleTime: 60 * 1000,
    enabled: !!user,
  })
  const { data: dealerBookingsData } = useQuery({
    queryKey: ['dealer-bookings-for-ml'],
    queryFn: () => bookingsService.getDealer(),
    enabled: user?.role === 'DEALER',
    staleTime: 30 * 1000,
  })

  const shipments = (shipmentsData?.shipments || shipmentsData?.data || []).map(normalizeShipment).filter(
    (s) => ['PENDING', 'OPTIMIZED', 'BOOKED'].includes(s.status)
  )
  const trucks = (trucksData?.trucks || trucksData?.data || []).map(normalizeTruck)
  const dealerBookings = dealerBookingsData?.bookings || []

  if (user?.role === 'DEALER') {
    return (
      <div>
        <PageHeader
          title="ML Insights"
          subtitle="Truck and ride focused predictions for dealers"
        >
          <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700">
            <Brain className="w-4 h-4" />
            <span className="font-medium">Dealer ML Mode</span>
          </div>
        </PageHeader>
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Ride Predictions</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Predictions are generated from your truck + accepted ride context.
              </p>
            </div>
          </Card.Header>
          <DealerRidePredictions bookings={dealerBookings} />
        </Card>
      </div>
    )
  }

  const tabs = [
    {
      key: 'recommend',
      label: '🚚 Truck Recommender',
      content: (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>AI Truck Recommender</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Get the best truck type for your shipment</p>
            </div>
          </Card.Header>
          <TruckRecommender shipments={shipments} />
        </Card>
      ),
    },
    {
      key: 'delivery',
      label: '⏱ Delivery Predictor',
      content: (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Delivery Time Predictor</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Estimate when your shipment will arrive</p>
            </div>
          </Card.Header>
          <DeliveryPredictor shipments={shipments} />
        </Card>
      ),
    },
    {
      key: 'delay',
      label: '⚠️ Delay Risk',
      content: (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Delay Risk Analyzer</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Predict and mitigate delivery delays</p>
            </div>
          </Card.Header>
          <DelayRiskAnalyzer shipments={shipments} />
        </Card>
      ),
    },
    {
      key: 'fuel',
      label: '⛽ Fuel Estimator',
      content: (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Fuel & Cost Estimator</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Calculate fuel requirements and CO₂ impact</p>
            </div>
          </Card.Header>
          <FuelEstimator shipments={shipments} trucks={trucks} />
        </Card>
      ),
    },
    {
      key: 'cluster',
      label: '🗺 Shipment Clustering',
      content: (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Geographic Shipment Clustering</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Group nearby shipments for consolidated routing</p>
            </div>
          </Card.Header>
          <ShipmentCluster />
        </Card>
      ),
    },
    {
      key: 'cargo',
      label: '📦 Cargo Optimizer',
      content: (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Cargo Loading Optimizer</Card.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Maximize truck utilization with optimal loading</p>
            </div>
          </Card.Header>
          <CargoOptimizer trucks={trucks} />
        </Card>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ML Insights"
        subtitle="AI-powered predictions and optimization tools"
      >
        <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700">
          <Brain className="w-4 h-4" />
          <span className="font-medium">AI Engine Active</span>
        </div>
      </PageHeader>

      <Tabs tabs={tabs} defaultTab="recommend" />
    </div>
  )
}
