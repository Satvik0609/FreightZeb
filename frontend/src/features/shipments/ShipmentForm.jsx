import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { shipmentsService } from '@/services/shipments.service'
import Button from '@/components/ui/Button'
import Input, { Textarea } from '@/components/ui/Input'
import Select from '@/components/ui/Select'

export default function ShipmentForm({ onSuccess, onCancel }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    origin: '', destination: '', weight: '', volume: '', boxes: '',
    description: '', deadline: '', specialInstructions: '',
    originLat: '', originLng: '', destinationLat: '', destinationLng: '',
  })
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    const e = {}
    if (!form.origin.trim()) e.origin = 'Origin required'
    if (!form.destination.trim()) e.destination = 'Destination required'
    if (!form.weight || isNaN(form.weight) || Number(form.weight) <= 0) e.weight = 'Valid weight required'
    if (!form.originLat || !form.originLng) e.originCoords = 'Origin coordinates required'
    if (!form.destinationLat || !form.destinationLng) e.destinationCoords = 'Destination coordinates required'
    return e
  }

  const mutation = useMutation({
    mutationFn: (data) => shipmentsService.create(data),
    onSuccess: () => {
      toast.success('Shipment created successfully!')
      qc.invalidateQueries({ queryKey: ['shipments'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['analytics-full'] })
      qc.invalidateQueries({ queryKey: ['dashboard-shipments'] })
      onSuccess?.()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create shipment'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mutation.mutate({
      weightKg: Number(form.weight),
      volumeM3: form.volume ? Number(form.volume) : undefined,
      boxes: form.boxes ? Number(form.boxes) : undefined,
      pickupLocation: {
        address: form.origin,
        city: form.origin,
        lat: Number(form.originLat),
        lng: Number(form.originLng),
      },
      destination: {
        address: form.destination,
        city: form.destination,
        lat: Number(form.destinationLat),
        lng: Number(form.destinationLng),
      },
      deadline: form.deadline || undefined,
      description: form.description || undefined,
      requirements: {
        notes: form.specialInstructions || '',
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Origin" placeholder="Mumbai, MH" value={form.origin} onChange={set('origin')} error={errors.origin} required />
        <Input label="Destination" placeholder="Delhi, DL" value={form.destination} onChange={set('destination')} error={errors.destination} required />
        <Input label="Weight (kg)" type="number" placeholder="1000" value={form.weight} onChange={set('weight')} error={errors.weight} required />
        <Input label="Volume (m³)" type="number" placeholder="10" value={form.volume} onChange={set('volume')} />
        <Input label="Boxes" type="number" placeholder="25" value={form.boxes} onChange={set('boxes')} />
        <Input label="Deadline" type="datetime-local" value={form.deadline} onChange={set('deadline')} />
        <Input label="Description" placeholder="Brief description of cargo" value={form.description} onChange={set('description')} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">GPS Coordinates (Optional)</p>
        {errors.originCoords && <p className="text-xs text-red-600 mb-2">{errors.originCoords}</p>}
        {errors.destinationCoords && <p className="text-xs text-red-600 mb-2">{errors.destinationCoords}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input label="Origin Lat" type="number" step="any" placeholder="18.9388" value={form.originLat} onChange={set('originLat')} />
          <Input label="Origin Lng" type="number" step="any" placeholder="72.8354" value={form.originLng} onChange={set('originLng')} />
          <Input label="Dest Lat" type="number" step="any" placeholder="28.6139" value={form.destinationLat} onChange={set('destinationLat')} />
          <Input label="Dest Lng" type="number" step="any" placeholder="77.2090" value={form.destinationLng} onChange={set('destinationLng')} />
        </div>
      </div>

      <Textarea label="Special Instructions" placeholder="Fragile, keep upright, etc." value={form.specialInstructions} onChange={set('specialInstructions')} rows={3} />

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={mutation.isPending} className="flex-1">Create Shipment</Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  )
}
