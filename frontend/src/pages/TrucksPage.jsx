import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Truck, MapPin, Edit, Trash2, Navigation, Target, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { trucksService } from '@/services/trucks.service'
import { bookingsService } from '@/services/bookings.service'
import { useAuthStore } from '@/store/authStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatWeight, formatVolume, formatCurrency, formatDistance } from '@/utils/formatters'
import { TRUCK_TYPES, TRUCK_STATUS_OPTIONS } from '@/utils/constants'
import { normalizeTruck } from '@/utils/normalizers'

function TruckForm({ truck, onSuccess, onCancel }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    registrationNumber: truck?.registrationNumber || truck?.registrationNo || '',
    truckType: truck?.truckType || 'CONTAINER_20FT',
    capacityWeight: truck?.capacityWeight || truck?.capacityKg || '',
    capacityVolume: truck?.capacityVolume || truck?.capacityM3 || '',
    routeFrom: truck?.routeFrom || '',
    routeTo: truck?.routeTo || '',
    pricePerKm: truck?.pricePerKm || '',
    availability: truck?.availability ?? true,
  })
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.registrationNumber.trim()) e.registrationNumber = 'Required'
    else if (!/^[A-Z]{2}\s?\d{2}\s?[A-Z]{1,2}\s?\d{4}$/i.test(form.registrationNumber.trim()))
      e.registrationNumber = 'Format: MH 01 AB 1234'
    if (!form.capacityWeight || Number(form.capacityWeight) <= 0) e.capacityWeight = 'Must be > 0'
    if (form.capacityVolume && Number(form.capacityVolume) <= 0) e.capacityVolume = 'Must be > 0'
    if (!form.routeFrom.trim()) e.routeFrom = 'Required'
    if (!form.routeTo.trim()) e.routeTo = 'Required'
    if (form.pricePerKm && Number(form.pricePerKm) <= 0) e.pricePerKm = 'Must be > 0'
    return e
  }

  const mutation = useMutation({
    mutationFn: (data) => truck ? trucksService.update(truck.id, data) : trucksService.create(data),
    onSuccess: () => {
      toast.success(truck ? 'Truck updated!' : 'Truck registered!')
      qc.invalidateQueries({ queryKey: ['trucks'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['truck-profit-opportunities'] })
      onSuccess?.()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mutation.mutate({
      registrationNo: form.registrationNumber.trim().toUpperCase(),
      truckType: form.truckType,
      capacityKg: Number(form.capacityWeight),
      capacityM3: form.capacityVolume ? Number(form.capacityVolume) : undefined,
      routeFrom: form.routeFrom.trim(),
      routeTo: form.routeTo.trim(),
      pricePerKm: form.pricePerKm ? Number(form.pricePerKm) : undefined,
      availability: form.availability,
    })
  }

  const TRUCK_TYPE_INFO = {
    SMALL_VAN: { icon: '🚐', desc: 'Up to 1.5 t · city deliveries', maxKg: 1500 },
    CONTAINER_20FT: { icon: '🚛', desc: 'Up to 20 t · standard freight', maxKg: 20000 },
    CONTAINER_32FT: { icon: '🚛', desc: 'Up to 30 t · heavy freight', maxKg: 30000 },
    FLATBED_TRAILER: { icon: '🚚', desc: 'Up to 25 t · oversized / machinery', maxKg: 25000 },
    REEFER: { icon: '❄️', desc: 'Up to 18 t · temperature controlled', maxKg: 18000 },
  }
  const typeInfo = TRUCK_TYPE_INFO[form.truckType] || {}

  // Estimated revenue preview
  const estRevenue = form.pricePerKm && form.routeFrom && form.routeTo
    ? null  // can't compute without distance, just show placeholder
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Section 1: Identity ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Vehicle Identity
        </p>
        <div className="space-y-3">
          <div>
            <Input
              label="Registration Number *"
              placeholder="MH 01 AB 1234"
              value={form.registrationNumber}
              onChange={set('registrationNumber')}
              className={errors.registrationNumber ? 'border-red-400' : ''}
            />
            {errors.registrationNumber
              ? <p className="text-xs text-red-500 mt-1">{errors.registrationNumber}</p>
              : <p className="text-xs text-gray-400 mt-1">State code · RTO code · Series · Number (e.g. KA 01 AB 1234)</p>
            }
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Truck Type *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(TRUCK_TYPE_INFO).map(([type, info]) => (
                <label
                  key={type}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.truckType === type
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                >
                  <input
                    type="radio"
                    name="truckType"
                    value={type}
                    checked={form.truckType === type}
                    onChange={set('truckType')}
                    className="accent-indigo-600"
                  />
                  <span className="text-xl">{info.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{info.desc}</p>
                  </div>
                  <span className="text-xs text-gray-400">max {(info.maxKg / 1000).toFixed(0)} t</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Capacity ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Capacity
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="Weight Capacity (kg) *"
              type="number"
              min="1"
              placeholder={typeInfo.maxKg ? String(typeInfo.maxKg) : '10000'}
              value={form.capacityWeight}
              onChange={set('capacityWeight')}
              className={errors.capacityWeight ? 'border-red-400' : ''}
            />
            {errors.capacityWeight
              ? <p className="text-xs text-red-500 mt-1">{errors.capacityWeight}</p>
              : typeInfo.maxKg && Number(form.capacityWeight) > typeInfo.maxKg
                ? <p className="text-xs text-amber-500 mt-1">Exceeds typical max for this type ({(typeInfo.maxKg / 1000).toFixed(0)} t)</p>
                : <p className="text-xs text-gray-400 mt-1">Maximum load in kilograms</p>
            }
          </div>
          <div>
            <Input
              label="Volume Capacity (m³)"
              type="number"
              min="0"
              placeholder="40"
              value={form.capacityVolume}
              onChange={set('capacityVolume')}
              className={errors.capacityVolume ? 'border-red-400' : ''}
            />
            {errors.capacityVolume
              ? <p className="text-xs text-red-500 mt-1">{errors.capacityVolume}</p>
              : <p className="text-xs text-gray-400 mt-1">Optional — cargo volume in cubic metres</p>
            }
          </div>
        </div>
      </div>

      {/* ── Section 3: Route ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Operating Route
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="From (City / Region) *"
              placeholder="Mumbai"
              value={form.routeFrom}
              onChange={set('routeFrom')}
              className={errors.routeFrom ? 'border-red-400' : ''}
            />
            {errors.routeFrom
              ? <p className="text-xs text-red-500 mt-1">{errors.routeFrom}</p>
              : <p className="text-xs text-gray-400 mt-1">Origin city or region</p>
            }
          </div>
          <div>
            <Input
              label="To (City / Region) *"
              placeholder="Delhi"
              value={form.routeTo}
              onChange={set('routeTo')}
              className={errors.routeTo ? 'border-red-400' : ''}
            />
            {errors.routeTo
              ? <p className="text-xs text-red-500 mt-1">{errors.routeTo}</p>
              : <p className="text-xs text-gray-400 mt-1">Destination city or region</p>
            }
          </div>
        </div>
        {form.routeFrom && form.routeTo && (
          <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Route: <strong>{form.routeFrom}</strong> → <strong>{form.routeTo}</strong></span>
          </div>
        )}
      </div>

      {/* ── Section 4: Pricing ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Pricing
        </p>
        <div>
          <Input
            label="Price Per Km (₹)"
            type="number"
            min="0"
            step="0.01"
            placeholder="25.00"
            value={form.pricePerKm}
            onChange={set('pricePerKm')}
            className={errors.pricePerKm ? 'border-red-400' : ''}
          />
          {errors.pricePerKm
            ? <p className="text-xs text-red-500 mt-1">{errors.pricePerKm}</p>
            : <p className="text-xs text-gray-400 mt-1">
              Your charge per km · used to calculate revenue and profit on shipment matches
              {form.pricePerKm && ` · ₹${Number(form.pricePerKm).toFixed(2)}/km`}
            </p>
          }
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
        <Button type="submit" loading={mutation.isPending} className="flex-1">
          {truck ? 'Save Changes' : 'Register Truck'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  )
}

function GPSUpdateModal({ truck, onClose }) {
  const qc = useQueryClient()
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  const mutation = useMutation({
    mutationFn: () => trucksService.updateLocation(truck.id, Number(lat), Number(lng)),
    onSuccess: () => {
      toast.success('Location updated!')
      qc.invalidateQueries({ queryKey: ['trucks'] })
      qc.invalidateQueries({ queryKey: ['tracking'] })
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Update GPS location for <strong>{truck.registrationNumber}</strong>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitude" type="number" step="any" placeholder="18.9388" value={lat} onChange={(e) => setLat(e.target.value)} required />
        <Input label="Longitude" type="number" step="any" placeholder="72.8354" value={lng} onChange={(e) => setLng(e.target.value)} required />
      </div>
      <div className="flex gap-3">
        <Button onClick={() => mutation.mutate()} disabled={!lat || !lng} loading={mutation.isPending} className="flex-1">Update Location</Button>
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
      </div>
    </div>
  )
}

export default function TrucksPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTruck, setEditTruck] = useState(null)
  const [gpsTruck, setGpsTruck] = useState(null)
  const [selectedTruck, setSelectedTruck] = useState(null)
  const [showMatches, setShowMatches] = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const isDealer = user?.role === 'DEALER' || user?.role === 'CARGO_DEALER'

  const { data, isLoading } = useQuery({
    queryKey: ['trucks', user?.role],
    queryFn: () => isAdmin ? trucksService.getAll() : trucksService.getMy(),
    staleTime: 30 * 1000,
  })
  const { data: opportunitiesData, isLoading: isOpportunitiesLoading } = useQuery({
    queryKey: ['truck-profit-opportunities'],
    queryFn: () => trucksService.getProfitOpportunities(),
    enabled: isDealer,
    staleTime: 30 * 1000,
  })
  const { data: matchesData, isLoading: isMatchesLoading } = useQuery({
    queryKey: ['truck-shipment-matches', selectedTruck?.id],
    queryFn: () => trucksService.shipmentMatches(selectedTruck.id, { limit: 8 }),
    enabled: isDealer && Boolean(selectedTruck?.id) && showMatches,
    staleTime: 30 * 1000,
  })

  const acceptMutation = useMutation({
    mutationFn: ({ shipmentId, truckId }) => bookingsService.dealerAccept({ shipmentId, truckId }),
    onSuccess: () => {
      toast.success('Shipment accepted and moved to Bookings')
      qc.invalidateQueries({ queryKey: ['trucks'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['truck-profit-opportunities'] })
      qc.invalidateQueries({ queryKey: ['truck-shipment-matches'] })
      qc.invalidateQueries({ queryKey: ['shipments'] })
      navigate('/bookings')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to accept shipment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => trucksService.delete(id),
    onSuccess: () => { toast.success('Truck deleted'); qc.invalidateQueries({ queryKey: ['trucks'] }) },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  const trucks = (data?.trucks || data?.data || []).map(normalizeTruck).filter((t) => {
    const matchSearch = !search || t.registrationNumber.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || t.status === statusFilter
    const matchType = !typeFilter || t.truckType === typeFilter
    return matchSearch && matchStatus && matchType
  })
  const opportunities = opportunitiesData?.opportunities || []

  const typeColors = {
    SMALL_VAN: 'bg-blue-100 text-blue-700',
    CONTAINER_20FT: 'bg-green-100 text-green-700',
    CONTAINER_32FT: 'bg-emerald-100 text-emerald-700',
    FLATBED_TRAILER: 'bg-orange-100 text-orange-700',
    REEFER: 'bg-cyan-100 text-cyan-700',
  }

  return (
    <div>
      <PageHeader
        title="Trucks"
        subtitle={`${trucks.length} truck${trucks.length !== 1 ? 's' : ''}`}
        actions={
          isDealer && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Register Truck
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Search by registration..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          className="flex-1 min-w-48"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={TRUCK_STATUS_OPTIONS} placeholder="All Statuses" className="w-40" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={TRUCK_TYPES} placeholder="All Types" className="w-44" />
      </div>
      {isDealer && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-3">
          Click a truck card to see its ranked shipment matches.
        </p>
      )}

      {isDealer && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Max Profit Shipment Opportunities</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Real-time from Prisma DB</span>
          </div>
          {isOpportunitiesLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading opportunities...</p>
          ) : opportunities.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No profitable open shipments currently match your available trucks.
            </p>
          ) : (
            <div className="space-y-3">
              {opportunities.slice(0, 5).map((item) => (
                <div key={item.shipment.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Shipment #{item.shipment.id.slice(0, 8)} - {item.bestMatch.registrationNo}
                    </p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      Profit: {formatCurrency(item.bestMatch.estimatedProfit)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <p>Weight: {formatWeight(item.shipment.weightKg)}</p>
                    <p>Distance: {formatDistance(item.bestMatch.distanceKm)}</p>
                    <p>Revenue: {formatCurrency(item.bestMatch.estimatedRevenue)}</p>
                    <p>Cost: {formatCurrency(item.bestMatch.estimatedOperatingCost)}</p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate({ shipmentId: item.shipment.id, truckId: item.bestMatch.truckId })}
                      loading={acceptMutation.isPending}
                    >
                      Accept Shipment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Per-truck shipment matches (scored ranking) */}
      {isDealer && selectedTruck && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                Best Shipment Matches — {selectedTruck.registrationNumber}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Ranked by fit score (utilization 40% · route 25% · profit 25% · urgency 10%)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setSelectedTruck(null); setShowMatches(false) }}>
                Clear
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowMatches((v) => !v)}>
                {showMatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showMatches ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>

          {showMatches && (
            <>
              {selectedTruck.status !== 'AVAILABLE' ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
                  This truck is currently <strong>{selectedTruck.status}</strong> — it must be AVAILABLE to accept new shipments.
                </div>
              ) : isMatchesLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading matches...</p>
              ) : !matchesData?.matches?.length ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No open shipments currently fit this truck's capacity and lane.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 pr-4">Shipment</th>
                        <th className="pb-2 pr-4">Lane</th>
                        <th className="pb-2 pr-4">Fit</th>
                        <th className="pb-2 pr-4">Distance</th>
                        <th className="pb-2 pr-4">Revenue</th>
                        <th className="pb-2 pr-4">Profit</th>
                        <th className="pb-2 pr-4">Margin</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {matchesData.matches.map((row) => (
                        <tr key={row.shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">
                            {row.shipment.description || `#${row.shipment.id.slice(0, 8)}`}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                            {row.shipment.pickupLocation?.city || 'Pickup'} → {row.shipment.destination?.city || 'Dest'}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`font-semibold ${row.score >= 70 ? 'text-green-600 dark:text-green-400' : row.score >= 45 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}>
                              {row.score}%
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                            {row.distanceText || (row.distanceKm ? formatDistance(row.distanceKm) : '—')}
                            {row.durationText && <span className="block text-[11px] text-gray-400">{row.durationText}</span>}
                            {row.distanceSource === 'google_maps' && <span className="block text-[10px] text-blue-400">📍 Maps</span>}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                            {row.estimatedRevenue ? formatCurrency(row.estimatedRevenue) : '—'}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={row.estimatedProfit > 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500'}>
                              {row.estimatedProfit != null ? formatCurrency(row.estimatedProfit) : '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                            {row.marginPct != null ? `${row.marginPct}%` : '—'}
                          </td>
                          <td className="py-2">
                            <Button
                              size="xs"
                              onClick={() => acceptMutation.mutate({ shipmentId: row.shipment.id, truckId: selectedTruck.id })}
                              loading={acceptMutation.isPending && acceptMutation.variables?.shipmentId === row.shipment.id}
                            >
                              Accept
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : trucks.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No trucks found"
          description={isDealer ? "Register your first truck to start accepting bookings" : "No trucks match your filters"}
          action={isDealer && !search && !statusFilter ? () => setShowCreate(true) : undefined}
          actionLabel="Register Truck"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trucks.map((truck) => (
            <Card
              key={truck.id}
              className={`relative cursor-pointer transition-all ${isDealer ? 'hover:ring-2 hover:ring-indigo-400' : ''} ${selectedTruck?.id === truck.id ? 'ring-2 ring-indigo-500' : ''}`}
              onClick={() => {
                if (!isDealer) return
                if (selectedTruck?.id === truck.id) {
                  setSelectedTruck(null); setShowMatches(false)
                } else {
                  setSelectedTruck(truck); setShowMatches(true)
                }
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
                <StatusBadge status={truck.status} size="sm" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">{truck.registrationNumber}</h3>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 mb-3 ${typeColors[truck.truckType] || 'bg-gray-100 text-gray-700'}`}>
                {truck.truckType?.replace(/_/g, ' ')}
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div><p className="font-medium text-gray-700 dark:text-gray-300">Capacity</p><p>{formatWeight(truck.capacityWeight)}</p></div>
                {truck.capacityVolume && <div><p className="font-medium text-gray-700 dark:text-gray-300">Volume</p><p>{formatVolume(truck.capacityVolume)}</p></div>}
                <div><p className="font-medium text-gray-700 dark:text-gray-300">Route</p><p>{truck.routeFrom} → {truck.routeTo}</p></div>
                {truck.lastLatitude && <div><p className="font-medium text-gray-700 dark:text-gray-300">Location</p><p>{truck.lastLatitude?.toFixed(3)}, {truck.lastLongitude?.toFixed(3)}</p></div>}
              </div>

              <Card.Footer className="flex gap-2">
                {(isDealer || isAdmin) && (
                  <Button size="xs" variant="ghost" onClick={() => setEditTruck(truck)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                )}
                {isDealer && (
                  <Button size="xs" variant="ghost" onClick={() => setGpsTruck(truck)}>
                    <Navigation className="w-3.5 h-3.5" />
                  </Button>
                )}
                {isAdmin && (
                  <Button size="xs" variant="ghost" onClick={() => {
                    if (confirm('Delete this truck?')) deleteMutation.mutate(truck.id)
                  }}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                )}
              </Card.Footer>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Register Truck" size="xl">
        <TruckForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
      </Modal>
      <Modal isOpen={!!editTruck} onClose={() => setEditTruck(null)} title="Edit Truck" size="xl">
        <TruckForm truck={editTruck} onSuccess={() => setEditTruck(null)} onCancel={() => setEditTruck(null)} />
      </Modal>
      <Modal isOpen={!!gpsTruck} onClose={() => setGpsTruck(null)} title="Update GPS Location">
        {gpsTruck && <GPSUpdateModal truck={gpsTruck} onClose={() => setGpsTruck(null)} />}
      </Modal>
    </div>
  )
}
