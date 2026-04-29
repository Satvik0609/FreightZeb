import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Package, Truck, BookOpen, DollarSign, Users,
  AlertCircle, CheckCircle, Clock, Plus, ArrowRight, Activity,
  AlertTriangle, ArrowUpRight, ArrowDownLeft, BarChart2, MapPin, Layers, TrendingUp,
} from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { analyticsService } from '@/services/analytics.service'
import { shipmentsService } from '@/services/shipments.service'
import { bookingsService } from '@/services/bookings.service'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/shared/StatusBadge'
import Skeleton, { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate, formatRelative } from '@/utils/formatters'
import { normalizeAnalytics, normalizeBooking, normalizeShipment, normalizePrediction } from '@/utils/normalizers'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// Approximate warehouse physical capacity (used for progress bars / alerts).
// Adjust these to match your real warehouse size.
const WAREHOUSE_MAX_WEIGHT_KG = 50_000   // 50 tonnes
const WAREHOUSE_MAX_VOLUME_M3 = 1_000    // 1 000 m³

// ── Shared stat card ─────────────────────────────────────────────────────────
function StatsCard({ icon: Icon, label, value, change, color = 'blue', loading }) {
  const bg = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    amber:  'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    red:    'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  }
  if (loading) return <SkeletonCard />
  return (
    <Card className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg[color] || bg.blue}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {change && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{change}</p>}
      </div>
    </Card>
  )
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard({ data, loading }) {
  const navigate = useNavigate()
  const stats = data?.stats || {}

  const pieData = [
    { name: 'Pending', value: stats.pendingShipments || 0 },
    { name: 'In Transit', value: stats.inTransitShipments || 0 },
    { name: 'Delivered', value: stats.deliveredShipments || 0 },
    { name: 'Cancelled', value: stats.cancelledShipments || 0 },
  ].filter(d => d.value > 0)

  const revenueData = data?.revenueByMonth || data?.data?.revenueByMonth || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Users} label="Total Users" value={stats.totalUsers || 0} color="blue" loading={loading} />
        <StatsCard icon={Package} label="Total Shipments" value={stats.totalShipments || 0} color="green" loading={loading} />
        <StatsCard icon={Truck} label="Total Trucks" value={stats.totalTrucks || 0} color="amber" loading={loading} />
        <StatsCard icon={DollarSign} label="Total Revenue" value={formatCurrency(stats.totalRevenue || 0)} color="purple" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header><Card.Title>Shipment Distribution</Card.Title></Card.Header>
          {loading ? <Skeleton height="h-48" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {pieData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <Card.Header><Card.Title>Revenue Over Time</Card.Title></Card.Header>
          {loading ? <Skeleton height="h-48" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate('/admin/users')} variant="secondary" size="sm">Manage Users</Button>
        <Button onClick={() => navigate('/bookings')} variant="secondary" size="sm">View All Bookings</Button>
      </div>
    </div>
  )
}

// ── Warehouse Dashboard ───────────────────────────────────────────────────────
function WarehouseDashboard({ shipments, bookings, loadingShipments, loadingBookings }) {
  const navigate = useNavigate()
  const loading = loadingShipments || loadingBookings

  // ── KPI derivation from raw shipment list ──────────────────────────────────
  const totalShipments       = shipments.length
  const pendingShipments     = shipments.filter(s => s.status === 'PENDING').length
  const outgoingShipments    = shipments.filter(s => ['OPTIMIZED', 'BOOKED'].includes(s.status)).length
  const inTransitShipments   = shipments.filter(s => s.status === 'IN_TRANSIT').length
  const completedShipments   = shipments.filter(s => s.status === 'DELIVERED').length

  // Active bookings (not yet delivered/cancelled)
  const activeBookings = bookings
    .filter(b => ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(b.status))
    .map(normalizeBooking)

  // ── Inventory: shipments physically present in warehouse ───────────────────
  const inWarehouse = shipments.filter(s => ['PENDING', 'OPTIMIZED', 'BOOKED'].includes(s.status))
  const usedWeightKg = inWarehouse.reduce((acc, s) => acc + (s.weightKg ?? s.weight ?? 0), 0)
  const usedVolumeM3 = inWarehouse.reduce((acc, s) => acc + (s.volumeM3 ?? s.volume ?? 0), 0)
  const weightPct    = Math.min((usedWeightKg / WAREHOUSE_MAX_WEIGHT_KG) * 100, 100)
  const volumePct    = Math.min((usedVolumeM3 / WAREHOUSE_MAX_VOLUME_M3) * 100, 100)
  const utilPct      = (weightPct + volumePct) / 2

  // Cargo categories
  const categories = { FRAGILE: 0, PERISHABLE: 0, HAZARDOUS: 0, GENERAL: 0 }
  inWarehouse.forEach(s => {
    const req = s.requirements || {}
    if (req.fragile)         categories.FRAGILE++
    else if (req.tempControlled) categories.PERISHABLE++
    else if (req.hazardous)  categories.HAZARDOUS++
    else                     categories.GENERAL++
  })
  const categoryList = Object.entries(categories).filter(([, v]) => v > 0)

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const now   = Date.now()
  const h48ms = 48 * 60 * 60 * 1000

  const delayedShipments = shipments.filter(s => {
    const pred = s.predictions?.find(p => p.type === 'DELAY_RISK_PERCENT')
    return pred && Number(pred.value) >= 70
  })
  const urgentShipments = shipments.filter(s => {
    if (s.status !== 'PENDING' || !s.deadline) return false
    const diff = new Date(s.deadline) - now
    return diff > 0 && diff < h48ms
  })

  const alerts = [
    ...delayedShipments.map(s => ({
      type: 'delay', id: s.id,
      title: 'High Delay Risk',
      msg: `${s.origin || '—'} → ${s.destinationLabel || '—'}`,
    })),
    ...urgentShipments.map(s => ({
      type: 'urgent', id: s.id,
      title: 'Urgent Deadline',
      msg: `${s.origin || '—'} → ${s.destinationLabel || '—'}`,
    })),
    ...(utilPct >= 90 ? [{
      type: 'capacity', id: 'cap',
      title: 'Near Capacity',
      msg: `Warehouse at ${utilPct.toFixed(0)}% utilization`,
    }] : []),
  ]

  // ── Recent shipments helper ────────────────────────────────────────────────
  const recentShipments = shipments.slice(0, 6)

  const shipmentEventDate = (s) => {
    if (s.status === 'DELIVERED')  return s.deliveredAt || s.deliveryDate || s.updatedAt
    if (['IN_TRANSIT', 'PICKED_UP'].includes(s.status)) {
      const b = s.bookings?.[0]
      return b?.pickedUpAt || b?.pickupDate || s.updatedAt
    }
    return s.createdAt
  }
  const shipmentEventLabel = (status) => {
    const map = { PENDING: 'Received', OPTIMIZED: 'Scheduled', BOOKED: 'Assigned',
      IN_TRANSIT: 'Picked up', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }
    return map[status] || status
  }

  // ── Truck loading status label ─────────────────────────────────────────────
  const truckLoadLabel = (status) => {
    if (['REQUESTED', 'APPROVED'].includes(status)) return { text: 'Scheduled',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
    if (status === 'ASSIGNED')                       return { text: 'Loading',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
    if (status === 'PICKED_UP')                      return { text: 'Picked Up',  cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' }
    if (status === 'IN_TRANSIT')                     return { text: 'In Transit', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' }
    return { text: status, cls: 'bg-gray-100 text-gray-600' }
  }

  // ── Alert card styling ─────────────────────────────────────────────────────
  const alertStyle = {
    delay:    { border: 'border-amber-200 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-500', text: 'text-amber-700 dark:text-amber-400' },
    urgent:   { border: 'border-orange-200 dark:border-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-500', text: 'text-orange-700 dark:text-orange-400' },
    capacity: { border: 'border-red-200 dark:border-red-700', bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-500', text: 'text-red-700 dark:text-red-400' },
  }

  return (
    <div className="space-y-6">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loadingShipments ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatsCard icon={Package}         label="Total Shipments" value={totalShipments}     color="blue"   />
            <StatsCard icon={ArrowDownLeft}    label="Incoming"        value={pendingShipments}    color="amber"  />
            <StatsCard icon={ArrowUpRight}     label="Outgoing"        value={outgoingShipments}   color="green"  />
            <StatsCard icon={Truck}            label="In Transit"      value={inTransitShipments}  color="indigo" />
            <StatsCard icon={CheckCircle}      label="Completed"       value={completedShipments}  color="green"  />
          </>
        )}
      </div>

      {/* ── Inventory + Alerts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Inventory / Cargo Status */}
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Inventory & Cargo Status</Card.Title>
              <p className="text-xs text-gray-500 mt-0.5">{inWarehouse.length} shipment{inWarehouse.length !== 1 ? 's' : ''} currently in warehouse</p>
            </div>
            <Layers className="w-5 h-5 text-gray-400" />
          </Card.Header>
          {loadingShipments ? <Skeleton lines={5} height="h-6" /> : (
            <div className="space-y-4">
              {/* Weight utilization */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Weight</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {usedWeightKg.toFixed(0)} kg / {(WAREHOUSE_MAX_WEIGHT_KG / 1000).toFixed(0)} t
                    <span className={`ml-2 text-xs ${weightPct >= 90 ? 'text-red-500' : 'text-gray-400'}`}>
                      ({weightPct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${weightPct >= 90 ? 'bg-red-500' : weightPct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${weightPct}%` }}
                  />
                </div>
              </div>

              {/* Volume utilization */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Volume</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {usedVolumeM3.toFixed(1)} m³ / {WAREHOUSE_MAX_VOLUME_M3} m³
                    <span className={`ml-2 text-xs ${volumePct >= 90 ? 'text-red-500' : 'text-gray-400'}`}>
                      ({volumePct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${volumePct >= 90 ? 'bg-red-500' : volumePct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${volumePct}%` }}
                  />
                </div>
              </div>

              {/* Category breakdown */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Cargo Categories</p>
                {categoryList.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {categoryList.map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">
                          {key.charAt(0) + key.slice(1).toLowerCase()}
                        </span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-3">No cargo currently in warehouse</p>
                )}
              </div>

              {/* Near-capacity banner */}
              {utilPct >= 90 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                    Warehouse at {utilPct.toFixed(0)}% capacity — dispatch pending shipments
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Alerts */}
        <Card>
          <Card.Header>
            <Card.Title>Alerts</Card.Title>
            {alerts.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {alerts.length} active
              </span>
            )}
          </Card.Header>
          {loading ? <Skeleton lines={4} height="h-10" /> : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All clear</p>
              <p className="text-xs text-gray-400">No active alerts at this time</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, idx) => {
                const st = alertStyle[a.type] || alertStyle.delay
                return (
                  <div key={`${a.type}-${idx}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${st.border} ${st.bg}`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${st.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${st.text}`}>{a.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{a.msg}</p>
                    </div>
                    {a.id !== 'cap' && (
                      <button
                        onClick={() => navigate(`/shipments/${a.id}`)}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400 shrink-0"
                      >
                        View
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent Shipments + Truck Insights Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Shipments enriched */}
        <Card>
          <Card.Header>
            <Card.Title>Recent Shipments</Card.Title>
            <Button size="sm" onClick={() => navigate('/shipments')}>
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </Card.Header>
          {loadingShipments ? <Skeleton lines={5} height="h-12" /> : (
            <div className="space-y-1">
              {recentShipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">No shipments yet</p>
                  <Button size="sm" onClick={() => navigate('/shipments')} className="mt-3">
                    Create First Shipment
                  </Button>
                </div>
              ) : recentShipments.map((s) => (
                <div key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/shipments/${s.id}`)}>
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {s.origin || '—'} → {s.destinationLabel || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {shipmentEventLabel(s.status)}: {shipmentEventDate(s) ? formatDate(shipmentEventDate(s)) : '—'}
                    </p>
                  </div>
                  <StatusBadge status={s.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Scheduled Trucks / Dispatch Insights */}
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Scheduled Trucks</Card.Title>
              <p className="text-xs text-gray-500 mt-0.5">{activeBookings.length} active booking{activeBookings.length !== 1 ? 's' : ''}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/bookings')}>View All</Button>
          </Card.Header>
          {loadingBookings ? <Skeleton lines={4} height="h-12" /> : (
            <div className="space-y-2">
              {activeBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Truck className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">No trucks scheduled</p>
                  <button
                    onClick={() => navigate('/ml-insights')}
                    className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open Cargo Optimizer →
                  </button>
                </div>
              ) : activeBookings.map((b) => {
                const ls = truckLoadLabel(b.status)
                return (
                  <div key={b.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/bookings/${b.id}`)}>
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.truck?.registrationNumber || '—'}
                        {b.truck?.truckType ? ` · ${b.truck.truckType.replace(/_/g, ' ')}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {b.shipment?.origin || '—'} → {b.shipment?.destinationLabel || '—'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ls.cls}`}>
                      {ls.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Quick Actions ── */}
      <Card>
        <Card.Header>
          <Card.Title>Quick Actions</Card.Title>
        </Card.Header>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'New Shipment',     path: '/shipments',   icon: Package,    desc: 'Create a freight shipment' },
            { label: 'My Bookings',      path: '/bookings',    icon: BookOpen,   desc: 'Track active bookings' },
            { label: 'Cargo Optimizer',  path: '/ml-insights', icon: BarChart2,  desc: 'Optimize truck loading' },
            { label: 'Live Tracking',    path: '/tracking',    icon: MapPin,     desc: 'Track shipments live' },
            { label: 'ML Insights',      path: '/ml-insights', icon: Activity,   desc: 'AI predictions' },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-center">
              <a.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{a.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Dealer Dashboard ──────────────────────────────────────────────────────────
function DealerDashboard({ data, loading }) {
  const navigate = useNavigate()
  const stats = data?.stats || {}
  const pendingBookings = (data?.pendingBookings || []).map(normalizeBooking)
  const bookingPredictions = pendingBookings.map((booking) => {
    const preds = (booking.shipment?.predictions || []).map(normalizePrediction)
    const delay = preds.find((p) => p.type === 'DELAY_RISK_PERCENT')
    return { booking, delay }
  }).filter((x) => x.delay).sort((a, b) => b.delay.value - a.delay.value)
  const freshestPrediction = bookingPredictions[0]?.delay?.generatedAt || null
  const freshnessText = freshestPrediction ? `${Math.round((Date.now() - new Date(freshestPrediction).getTime()) / 60000)}m ago` : 'No ML data'

  const fleetData = [
    { name: 'Available',    value: stats.availableTrucks || 0,    fill: '#10b981' },
    { name: 'On Trip',      value: stats.onTripTrucks || 0,       fill: '#f59e0b' },
    { name: 'Maintenance',  value: stats.maintenanceTrucks || 0,  fill: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Truck}     label="My Fleet"          value={stats.totalTrucks || 0}                   color="blue"   loading={loading} />
        <StatsCard icon={BookOpen}  label="Pending Requests"  value={stats.pendingBookings || 0}               color="amber"  loading={loading} />
        <StatsCard icon={Activity}  label="On Trip Trucks"    value={stats.onTripTrucks || 0}                  color="green"  loading={loading} />
        <StatsCard icon={TrendingUp} label="Fleet Utilization" value={`${stats.fleetUtilization || 0}%`}       color="purple" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <Card.Title>Pending Booking Requests</Card.Title>
            <Button size="sm" variant="secondary" onClick={() => navigate('/bookings')}>View All</Button>
          </Card.Header>
          {loading ? <Skeleton lines={4} height="h-10" /> : (
            <div className="space-y-2">
              {pendingBookings.slice(0, 5).map((b) => (
                <div key={b.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  onClick={() => navigate(`/bookings/${b.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {b.shipment?.origin} → {b.shipment?.destinationLabel}
                    </p>
                    <p className="text-xs text-gray-500">{b.truck?.registrationNumber} • {formatRelative(b.createdAt)}</p>
                  </div>
                  <StatusBadge status={b.status} size="sm" />
                </div>
              ))}
              {pendingBookings.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No pending requests</p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <Card.Header><Card.Title>Fleet Utilization</Card.Title></Card.Header>
          {loading ? <Skeleton height="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fleetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {fleetData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Top Risk Bookings</Card.Title>
              <p className="text-xs text-gray-500 mt-0.5">ML updated {freshnessText}</p>
            </div>
          </Card.Header>
          {loading ? <Skeleton lines={3} height="h-10" /> : (
            <div className="space-y-2">
              {bookingPredictions.slice(0, 3).map(({ booking, delay }) => (
                <div key={booking.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.shipment?.origin} → {booking.shipment?.destinationLabel}</p>
                  <p className="text-xs text-amber-600">{Number(delay.value).toFixed(1)}% risk {delay.fallback ? '• heuristic' : ''}</p>
                </div>
              ))}
              {bookingPredictions.length === 0 && <p className="text-sm text-gray-400">No high-risk predictions yet.</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore()

  const analyticsQuery = useQuery({
    queryKey: ['analytics', user?.role],
    queryFn: () => {
      if (user?.role === 'ADMIN')      return analyticsService.getAdmin()
      if (user?.role === 'WAREHOUSE')  return analyticsService.getWarehouse()
      return analyticsService.getDealer()
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })

  // Warehouse: real shipment list — source of truth for KPIs + inventory
  const warehouseShipmentsQuery = useQuery({
    queryKey: ['dashboard-shipments', user?.role],
    queryFn: () => shipmentsService.getMy(),
    enabled: user?.role === 'WAREHOUSE',
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
  })

  // Warehouse: booking list — truck insights + active booking count
  const warehouseBookingsQuery = useQuery({
    queryKey: ['dashboard-warehouse-bookings'],
    queryFn: () => bookingsService.getMy(),
    enabled: user?.role === 'WAREHOUSE',
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
  })

  // Dealer: pending booking requests
  const pendingBookingsQuery = useQuery({
    queryKey: ['dashboard-pending-bookings', user?.role],
    queryFn: () => (user?.role === 'DEALER' ? bookingsService.getDealer() : Promise.resolve({ bookings: [] })),
    enabled: user?.role === 'DEALER',
    staleTime: 30 * 1000,
  })

  // Admin + Dealer still use analytics-normalized data
  const normalizedAnalytics = normalizeAnalytics(user?.role, analyticsQuery.data)
  const dashboardData = {
    ...normalizedAnalytics,
    pendingBookings: (pendingBookingsQuery.data?.bookings || []).filter((b) => b.status === 'REQUESTED'),
  }

  // Warehouse: derive from raw shipments (with their predictions + bookings included)
  const rawShipments  = (warehouseShipmentsQuery.data?.shipments || []).map(normalizeShipment)
  const rawBookings   = warehouseBookingsQuery.data?.bookings || []

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Here's what's happening with your logistics today.
        </p>
      </div>

      {user?.role === 'ADMIN' && (
        <AdminDashboard data={dashboardData} loading={analyticsQuery.isLoading} />
      )}
      {user?.role === 'WAREHOUSE' && (
        <WarehouseDashboard
          shipments={rawShipments}
          bookings={rawBookings}
          loadingShipments={warehouseShipmentsQuery.isLoading}
          loadingBookings={warehouseBookingsQuery.isLoading}
        />
      )}
      {user?.role === 'DEALER' && (
        <DealerDashboard data={dashboardData} loading={analyticsQuery.isLoading || pendingBookingsQuery.isLoading} />
      )}
    </div>
  )
}
