import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Truck, MapPin, Edit, Trash2, Navigation } from 'lucide-react'
import toast from 'react-hot-toast'
import { trucksService } from '@/services/trucks.service'
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
import { formatWeight, formatVolume } from '@/utils/formatters'
import { TRUCK_TYPES, TRUCK_STATUS_OPTIONS } from '@/utils/constants'
import { normalizeTruck } from '@/utils/normalizers'

function TruckForm({ truck, onSuccess, onCancel }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    registrationNumber: truck?.registrationNumber || truck?.registrationNo || '',
    truckType: truck?.truckType || 'SMALL_VAN',
    capacityWeight: truck?.capacityWeight || truck?.capacityKg || '',
    capacityVolume: truck?.capacityVolume || truck?.capacityM3 || '',
    routeFrom: truck?.routeFrom || '',
    routeTo: truck?.routeTo || '',
    pricePerKm: truck?.pricePerKm || '',
  })

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => truck ? trucksService.update(truck.id, data) : trucksService.create(data),
    onSuccess: () => {
      toast.success(truck ? 'Truck updated!' : 'Truck registered!')
      qc.invalidateQueries({ queryKey: ['trucks'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['analytics-full'] })
      onSuccess?.()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      registrationNo: form.registrationNumber,
      truckType: form.truckType,
      capacityKg: Number(form.capacityWeight),
      capacityM3: form.capacityVolume ? Number(form.capacityVolume) : undefined,
      routeFrom: form.routeFrom,
      routeTo: form.routeTo,
      pricePerKm: form.pricePerKm ? Number(form.pricePerKm) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Registration Number" placeholder="MH 01 AB 1234" value={form.registrationNumber} onChange={set('registrationNumber')} required className="col-span-2" />
        <Select label="Truck Type" value={form.truckType} onChange={set('truckType')} options={TRUCK_TYPES} required />
        <Input label="Capacity (kg)" type="number" value={form.capacityWeight} onChange={set('capacityWeight')} required />
        <Input label="Volume (m³)" type="number" value={form.capacityVolume} onChange={set('capacityVolume')} />
        <Input label="Route From" value={form.routeFrom} onChange={set('routeFrom')} required />
        <Input label="Route To" value={form.routeTo} onChange={set('routeTo')} required />
        <Input label="Price Per Km" type="number" value={form.pricePerKm} onChange={set('pricePerKm')} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={mutation.isPending} className="flex-1">
          {truck ? 'Update Truck' : 'Register Truck'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
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
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTruck, setEditTruck] = useState(null)
  const [gpsTruck, setGpsTruck] = useState(null)

  const isAdmin = user?.role === 'ADMIN'
  const isDealer = user?.role === 'DEALER'

  const { data, isLoading } = useQuery({
    queryKey: ['trucks', user?.role],
    queryFn: () => isAdmin ? trucksService.getAll() : trucksService.getMy(),
    staleTime: 30 * 1000,
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
            <Card key={truck.id} className="relative">
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Register Truck" size="lg">
        <TruckForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
      </Modal>
      <Modal isOpen={!!editTruck} onClose={() => setEditTruck(null)} title="Edit Truck" size="lg">
        <TruckForm truck={editTruck} onSuccess={() => setEditTruck(null)} onCancel={() => setEditTruck(null)} />
      </Modal>
      <Modal isOpen={!!gpsTruck} onClose={() => setGpsTruck(null)} title="Update GPS Location">
        {gpsTruck && <GPSUpdateModal truck={gpsTruck} onClose={() => setGpsTruck(null)} />}
      </Modal>
    </div>
  )
}
