import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Trucks() {
  const [trucks, setTrucks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    registrationNo: '',
    type: 'CONTAINER_20FT',
    capacityKg: '',
    capacityM3: ''
  })

  useEffect(() => {
    fetchTrucks()
  }, [])

  const fetchTrucks = async () => {
    try {
      const response = await axios.get('/api/trucks')
      setTrucks(response.data)
    } catch (error) {
      console.error('Failed to fetch trucks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/trucks', formData)
      setShowForm(false)
      setFormData({
        registrationNo: '',
        type: 'CONTAINER_20FT',
        capacityKg: '',
        capacityM3: ''
      })
      fetchTrucks()
    } catch (error) {
      console.error('Failed to create truck:', error)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      AVAILABLE: 'bg-green-100 text-green-800',
      ASSIGNED: 'bg-blue-100 text-blue-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      MAINTENANCE: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Trucks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
        >
          {showForm ? 'Cancel' : 'Add Truck'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">New Truck</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                <input
                  type="text"
                  value={formData.registrationNo}
                  onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="SMALL_VAN">Small Van</option>
                  <option value="CONTAINER_20FT">Container 20ft</option>
                  <option value="CONTAINER_32FT">Container 32ft</option>
                  <option value="FLATBED_TRAILER">Flatbed Trailer</option>
                  <option value="REEFER">Reefer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Capacity (kg)</label>
                <input
                  type="number"
                  value={formData.capacityKg}
                  onChange={(e) => setFormData({ ...formData, capacityKg: parseFloat(e.target.value) })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Capacity (m³)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.capacityM3}
                  onChange={(e) => setFormData({ ...formData, capacityM3: parseFloat(e.target.value) })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
            >
              Add Truck
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trucks.map((truck) => (
          <div key={truck.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{truck.registrationNo}</h3>
                <p className="text-sm text-gray-500">{truck.type.replace(/_/g, ' ')}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(truck.status)}`}>
                {truck.status}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Capacity:</span>
                <span className="font-medium">{truck.capacityKg} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Volume:</span>
                <span className="font-medium">{truck.capacityM3} m³</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Deliveries:</span>
                <span className="font-medium">{truck._count?.deliveries || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
