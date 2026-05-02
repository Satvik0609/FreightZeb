import { useQuery } from '@tanstack/react-query'
import { DollarSign, FileClock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { analyticsService } from '@/services/analytics.service'
import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatNumber } from '@/utils/formatters'

function MetricCard({ icon: Icon, label, value, loading, tone = 'blue' }) {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  }
  if (loading) return <SkeletonCard />
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </Card>
  )
}

export default function FinancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance-summary'],
    queryFn: async () => {
      try {
        return await adminService.getFinanceSummary()
      } catch (err) {
        // Backward compatibility: older backend builds may not yet expose /admin/finance/summary.
        if (err?.response?.status !== 404) throw err
        const analyticsRes = await analyticsService.getAdmin()
        const monthlyRevenue = analyticsRes?.revenueByMonth || []
        const totalRevenue = Number(
          monthlyRevenue.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0).toFixed(2)
        )
        return {
          summary: {
            totalRevenue,
            pendingInvoices: 0,
            overdueInvoices: 0,
            paidInvoices: 0,
          },
          monthlyRevenue,
          _fallbackSource: 'admin-analytics',
        }
      }
    },
    staleTime: 60 * 1000,
  })

  const summary = data?.summary || {}
  const monthlyRevenue = data?.monthlyRevenue || []
  const isFallback = Boolean(data?._fallbackSource)

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" subtitle="Platform finance KPIs and revenue controls" />


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue || 0)}
          loading={isLoading}
          tone="blue"
        />
        <MetricCard
          icon={FileClock}
          label="Pending Invoices"
          value={formatNumber(summary.pendingInvoices || 0)}
          loading={isLoading}
          tone="amber"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Overdue Invoices"
          value={formatNumber(summary.overdueInvoices || 0)}
          loading={isLoading}
          tone="red"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Paid Invoices"
          value={formatNumber(summary.paidInvoices || 0)}
          loading={isLoading}
          tone="green"
        />
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Revenue Trend</Card.Title>
        </Card.Header>
        {isLoading ? (
          <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
        ) : monthlyRevenue.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">
            No revenue history available yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
