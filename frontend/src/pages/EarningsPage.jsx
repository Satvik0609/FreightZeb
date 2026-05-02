import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Wallet, TrendingUp, Route, Percent } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { analyticsService } from '@/services/analytics.service'
import { formatCurrency, formatDate, formatDistance, formatNumber, formatPercent } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'

function StatCard({ icon: Icon, label, value, loading = false }) {
  if (loading) return <SkeletonCard />
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function ChartEmpty({ message }) {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  )
}

function formatLocation(value) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return value.city || value.address || [value.lat, value.lng].filter((v) => v != null).join(', ') || '—'
  }
  return String(value)
}

export default function EarningsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['earnings', isAdmin ? 'admin' : 'dealer'],
    queryFn: async () => {
      if (!isAdmin) return analyticsService.getDealerEarnings()
      try {
        return await analyticsService.getAdminEarnings()
      } catch (err) {
        // Backward compatibility: older backend builds may not yet expose /analytics/admin/earnings.
        if (err?.response?.status !== 404) throw err
        const adminAnalytics = await analyticsService.getAdmin()
        const analytics = adminAnalytics?.analytics || {}
        const revenueByMonth = adminAnalytics?.revenueByMonth || []
        const deliveredTrips = Number(analytics?.bookings?.byStatus?.DELIVERED || 0)
        const totalRevenue = Number(
          revenueByMonth.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0).toFixed(2)
        )
        return {
          metrics: {
            deliveredTrips,
            totalRevenue,
            totalOperatingCost: 0,
            totalProfit: totalRevenue,
            avgMarginPct: 100,
            payoutEligibleTrips: 0,
          },
          monthlyProfit: revenueByMonth.map((row) => ({
            month: row?.month,
            profit: Number(row?.revenue) || 0,
          })),
          topDealers: [],
          lowMarginDealers: [],
          _fallbackSource: 'admin-analytics',
        }
      }
    },
    staleTime: 60 * 1000,
  })

  const payload = data || {}
  const metrics = payload.metrics || {}
  const monthly = isAdmin ? (payload.monthlyProfit || []) : (payload.monthlyEarnings || [])
  const bookings = payload.bookings || []
  const topDealers = payload.topDealers || []
  const lowMarginDealers = payload.lowMarginDealers || []
  const isFallback = Boolean(payload._fallbackSource)

  const chartData = useMemo(
    () =>
      isAdmin
        ? monthly.map((m) => ({
          month: m.month,
          profit: Number(m.profit || 0),
        }))
        : monthly.map((m) => ({
          month: m.month,
          revenue: Number(m.revenue || 0),
          profit: Number(m.profit || 0),
        })),
    [monthly]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Dealer Earnings' : 'Dealer Earnings'}
        subtitle={isAdmin
          ? 'Dealer profitability and payout-focused earnings intelligence'
          : 'Revenue, operating cost and net profit across completed trips'}
      />


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label={isAdmin ? 'Platform Revenue' : 'Total Revenue'} value={formatCurrency(metrics.totalRevenue)} loading={isLoading} />
        <StatCard icon={TrendingUp} label="Total Profit" value={formatCurrency(metrics.totalProfit)} loading={isLoading} />
        <StatCard
          icon={Route}
          label={isAdmin ? 'Delivered Trips' : 'Distance Covered'}
          value={isAdmin ? formatNumber(metrics.deliveredTrips || 0) : formatDistance(metrics.totalDistanceKm || 0)}
          loading={isLoading}
        />
        <StatCard
          icon={Percent}
          label={isAdmin ? 'Avg Margin' : 'Avg Profit Margin'}
          value={formatPercent(isAdmin ? (metrics.avgMarginPct || 0) : (metrics.avgProfitMarginPct || 0), 2)}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <Card.Title>{isAdmin ? 'Platform Profit (12 months)' : 'Revenue vs Profit (12 months)'}</Card.Title>
          </Card.Header>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
          ) : chartData.length === 0 ? (
            <ChartEmpty message="No delivered trips yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="earningsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                {!isAdmin && <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#earningsRevenueGrad)" strokeWidth={2} />}
                <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>{isAdmin ? 'Dealer Payout Eligibility' : 'Monthly Operating Cost'}</Card.Title>
          </Card.Header>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
          ) : isAdmin ? (
            <div className="h-64 flex flex-col justify-center px-4">
              <div className="text-sm text-gray-500 mb-2">Payout Eligible Trips</div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {formatNumber(metrics.payoutEligibleTrips || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-2">Based on delivered bookings with paid invoices.</p>
            </div>
          ) : monthly.length === 0 ? (
            <ChartEmpty message="No operating cost trend available." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="operatingCost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <Card.Header><Card.Title>Top Dealers by Profit</Card.Title></Card.Header>
            {isLoading ? (
              <div className="h-44 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
            ) : topDealers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No dealer earnings data yet.</div>
            ) : (
              <div className="space-y-2">
                {topDealers.map((d) => (
                  <div key={d.dealerId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{d.dealerName}</p>
                      <p className="text-xs text-gray-500">{d.dealerCompany || d.dealerEmail || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(d.profit)}</p>
                      <p className="text-xs text-gray-500">{formatPercent(d.marginPct, 1)} margin</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <Card.Header><Card.Title>Low Margin Dealers</Card.Title></Card.Header>
            {isLoading ? (
              <div className="h-44 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
            ) : lowMarginDealers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No dealer earnings data yet.</div>
            ) : (
              <div className="space-y-2">
                {lowMarginDealers.map((d) => (
                  <div key={d.dealerId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{d.dealerName}</p>
                      <p className="text-xs text-gray-500">{d.deliveredTrips} delivered trips</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600 dark:text-amber-400">{formatPercent(d.marginPct, 1)}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(d.profit)} profit</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Card>
        <Card.Header>
          <Card.Title>{isAdmin ? 'Recent Earnings by Dealer Trips' : 'Recent Earnings by Trip'}</Card.Title>
        </Card.Header>
        {!isAdmin && isLoading ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
            <div className="h-12 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
            <div className="h-12 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
          </div>
        ) : !isAdmin && bookings.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No delivered bookings yet.</div>
        ) : !isAdmin ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 pr-4 font-medium">Trip</th>
                  <th className="py-2 pr-4 font-medium">Delivered</th>
                  <th className="py-2 pr-4 font-medium">Distance</th>
                  <th className="py-2 pr-4 font-medium">Revenue</th>
                  <th className="py-2 pr-4 font-medium">Cost</th>
                  <th className="py-2 pr-4 font-medium">Profit</th>
                  <th className="py-2 pr-0 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {formatLocation(row.shipment?.pickupLocation)} {'->'} {formatLocation(row.shipment?.destination)}
                      </div>
                      <div className="text-xs text-gray-500">{row.truckRegistrationNo || '—'}</div>
                    </td>
                    <td className="py-3 pr-4">{formatDate(row.deliveredAt)}</td>
                    <td className="py-3 pr-4">{formatDistance(row.distanceKm || 0)}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.revenue)}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.operatingCost)}</td>
                    <td className="py-3 pr-4 font-medium text-green-600 dark:text-green-400">{formatCurrency(row.profit)}</td>
                    <td className="py-3 pr-0">{formatPercent(row.marginPct || 0, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-sm text-gray-500">
            Detailed dealer-level tables are shown in <strong>Top Dealers</strong> and <strong>Low Margin Dealers</strong> for admin workflows.
          </div>
        )}
      </Card>
    </div>
  )
}
