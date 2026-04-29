import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import { TrendingUp, Package, Truck, DollarSign, Leaf, Clock } from 'lucide-react'
import { analyticsService } from '@/services/analytics.service'
import { useAuthStore } from '@/store/authStore'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters'
import { normalizeAnalytics } from '@/utils/normalizers'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function ChartEmpty({ message = 'No trend data available yet.' }) {
  return (
    <div className="h-56 flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub, color = 'blue', loading }) {
  const bg = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  }
  if (loading) return <SkeletonCard />
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

function AdminAnalytics({ data, loading }) {
  const stats = data?.stats || data?.data || {}
  const shipmentTrend = data?.shipmentTrend || data?.data?.shipmentTrend || []
  const revenueData = data?.revenueByMonth || data?.data?.revenueByMonth || []
  const fleetData = data?.fleetUtilization || data?.data?.fleetUtilization || []

  const statusDist = [
    { name: 'Pending', value: stats.pendingShipments || 0 },
    { name: 'In Transit', value: stats.inTransitShipments || 0 },
    { name: 'Delivered', value: stats.deliveredShipments || 0 },
    { name: 'Cancelled', value: stats.cancelledShipments || 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Package} label="Total Shipments" value={formatNumber(stats.totalShipments)} loading={loading} color="blue" />
        <MetricCard icon={DollarSign} label="Total Revenue" value={formatCurrency(stats.totalRevenue)} loading={loading} color="green" />
        <MetricCard icon={Truck} label="Active Trucks" value={formatNumber(stats.activeTrucks)} loading={loading} color="amber" />
        <MetricCard icon={TrendingUp} label="Delivered" value={formatNumber(stats.deliveredShipments)} loading={loading} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header><Card.Title>Revenue Over Time</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            revenueData.length === 0 ? (
              <ChartEmpty message="No revenue trend data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )
          )}
        </Card>

        <Card>
          <Card.Header><Card.Title>Shipment Status Distribution</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            statusDist.length === 0 ? (
              <ChartEmpty message="No status distribution data yet." />
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={220}>
                  <PieChart>
                    <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusDist.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                      <span className="text-gray-600 dark:text-gray-400">{d.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </Card>
      </div>

      {fleetData.length > 0 && (
        <Card>
          <Card.Header><Card.Title>Fleet Utilization by Type</Card.Title></Card.Header>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fleetData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

function WarehouseAnalytics({ data, loading }) {
  const stats = data?.stats || data?.data || {}
  const trend = data?.shipmentTrend || data?.data?.shipmentTrend || []
  const spendData = data?.monthlySpend || data?.data?.monthlySpend || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Package} label="Total Shipments" value={formatNumber(stats.totalShipments)} loading={loading} color="blue" />
        <MetricCard icon={DollarSign} label="Total Spend" value={formatCurrency(stats.totalSpend)} loading={loading} color="green" />
        <MetricCard icon={Clock} label="Avg Delivery Time" value={stats.avgDeliveryDays ? `${stats.avgDeliveryDays}d` : '—'} loading={loading} color="amber" />
        <MetricCard icon={Leaf} label="CO₂ Saved" value={stats.co2Saved ? `${stats.co2Saved} kg` : '—'} loading={loading} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header><Card.Title>Shipment Trend</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            trend.length === 0 ? (
              <ChartEmpty message="No shipment trend data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )
          )}
        </Card>

        <Card>
          <Card.Header><Card.Title>Monthly Spend</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            spendData.length === 0 ? (
              <ChartEmpty message="No spend data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatCurrency(v), 'Spend']} />
                  <Bar dataKey="spend" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </Card>
      </div>
    </div>
  )
}

function DealerAnalytics({ data, loading }) {
  const stats = data?.stats || data?.data || {}
  const fleetData = data?.fleetUtilization || data?.data?.fleetUtilization || []
  const typeData = data?.trucksByType || data?.data?.trucksByType || []
  const trucksAddedData = data?.trucksAddedByMonth || data?.data?.trucksAddedByMonth || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Truck} label="Fleet Size" value={formatNumber(stats.totalTrucks)} loading={loading} color="amber" />
        <MetricCard icon={Package} label="Available Trucks" value={formatNumber(stats.availableTrucks)} loading={loading} color="blue" />
        <MetricCard icon={TrendingUp} label="On Trip Trucks" value={formatNumber(stats.onTripTrucks)} loading={loading} color="green" />
        <MetricCard icon={Clock} label="Avg Price / Km" value={stats.avgPricePerKm != null ? formatCurrency(stats.avgPricePerKm) : '—'} loading={loading} color="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard icon={Truck} label="Total Capacity (Kg)" value={formatNumber(stats.totalCapacityKg)} loading={loading} color="amber" />
        <MetricCard icon={TrendingUp} label="Utilization" value={formatPercent(stats.fleetUtilization)} loading={loading} color="purple" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Clock} label="Avg Predicted ETA" value={stats.avgPredictedEtaHours != null ? `${stats.avgPredictedEtaHours}h` : '—'} loading={loading} color="blue" />
        <MetricCard icon={TrendingUp} label="Avg Delay Risk" value={stats.avgDelayRiskPercent != null ? `${stats.avgDelayRiskPercent}%` : '—'} loading={loading} color="red" />
        <MetricCard icon={Package} label="High-Risk Active Trips" value={formatNumber(stats.highRiskActiveTrips)} loading={loading} color="amber" />
        <MetricCard icon={Truck} label="Fallback Share" value={stats.fallbackShare != null ? formatPercent(stats.fallbackShare * 100) : '—'} loading={loading} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header><Card.Title>Fleet Status Distribution</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            fleetData.length === 0 ? (
              <ChartEmpty message="No fleet status data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fleetData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </Card>

        <Card>
          <Card.Header><Card.Title>Fleet Composition by Truck Type</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            typeData.length === 0 ? (
              <ChartEmpty message="No truck type composition data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <Card.Header><Card.Title>Truck Onboarding Trend</Card.Title></Card.Header>
          {loading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            trucksAddedData.length === 0 ? (
              <ChartEmpty message="No truck onboarding trend data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trucksAddedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )
          )}
        </Card>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-full', user?.role],
    queryFn: () => {
      if (user?.role === 'ADMIN') return analyticsService.getAdmin()
      if (user?.role === 'WAREHOUSE') return analyticsService.getWarehouse()
      return analyticsService.getDealer()
    },
    staleTime: 5 * 60 * 1000,
  })

  const normalized = normalizeAnalytics(user?.role, data)

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Platform performance insights and trends" />

      {user?.role === 'ADMIN' && <AdminAnalytics data={normalized} loading={isLoading} />}
      {user?.role === 'WAREHOUSE' && <WarehouseAnalytics data={normalized} loading={isLoading} />}
      {user?.role === 'DEALER' && <DealerAnalytics data={normalized} loading={isLoading} />}
    </div>
  )
}
