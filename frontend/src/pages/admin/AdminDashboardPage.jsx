import { useQuery } from '@tanstack/react-query'
import { Users, Package, Truck, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { analyticsService } from '@/services/analytics.service'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCurrency, formatNumber } from '@/utils/formatters'

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'ADMIN'],
    queryFn: () => analyticsService.getAdmin(),
    staleTime: 5 * 60 * 1000,
  })

  const analytics = data?.analytics || data?.data || {}
  const revenueByMonth = data?.revenueByMonth || data?.data?.revenueByMonth || []
  const stats = {
    totalUsers: analytics?.users?.total || 0,
    totalShipments: analytics?.shipments?.total || 0,
    totalTrucks: analytics?.trucks?.total || 0,
    totalRevenue: revenueByMonth.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0),
  }
  const revenue = revenueByMonth
  const shipments = data?.shipmentTrend || data?.data?.shipmentTrend || []

  const metrics = [
    { label: 'Total Users', value: formatNumber(stats.totalUsers), icon: Users, color: 'blue' },
    { label: 'Total Shipments', value: formatNumber(stats.totalShipments), icon: Package, color: 'green' },
    { label: 'Total Trucks', value: formatNumber(stats.totalTrucks), icon: Truck, color: 'amber' },
    { label: 'Platform Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'purple' },
  ]

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  }

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Platform-wide overview and statistics" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : metrics.map((m) => (
            <Card key={m.label}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[m.color]}`}>
                  <m.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{m.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{m.value}</p>
                </div>
              </div>
            </Card>
          ))
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header><Card.Title>Monthly Revenue</Card.Title></Card.Header>
          {isLoading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <Card.Header><Card.Title>Shipments per Month</Card.Title></Card.Header>
          {isLoading ? <div className="h-56 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shipments}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  )
}
