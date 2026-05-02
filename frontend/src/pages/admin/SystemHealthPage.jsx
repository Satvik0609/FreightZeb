import { useQuery } from '@tanstack/react-query'
import { Activity, Database, Cpu, ShieldAlert } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatNumber } from '@/utils/formatters'

function MetricCard({ icon: Icon, label, value, loading = false }) {
  if (loading) return <SkeletonCard />
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center justify-center">
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

export default function SystemHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: () => adminService.getSystemHealth(),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  })

  const health = data?.health || {}
  const memory = health.memory || {}
  const db = health.db || {}
  const ml = health.ml || {}

  return (
    <div className="space-y-6">
      <PageHeader title="System Health" subtitle="API, DB, ML and runtime health signals" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Activity} label="API Uptime (sec)" value={formatNumber(health.uptimeSec || 0)} loading={isLoading} />
        <MetricCard icon={Database} label="DB Latency (ms)" value={formatNumber(db.latencyMs || 0)} loading={isLoading} />
        <MetricCard icon={Cpu} label="Heap Used (MB)" value={formatNumber(memory.heapUsedMb || 0)} loading={isLoading} />
        <MetricCard icon={ShieldAlert} label="ML Circuit Open" value={ml?.circuit?.open ? 'Yes' : 'No'} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <Card.Title>Runtime</Card.Title>
          </Card.Header>
          {isLoading ? (
            <div className="h-36 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Service:</span> {health.service || '—'}</p>
              <p><span className="text-gray-500">Node:</span> {health.nodeVersion || '—'}</p>
              <p><span className="text-gray-500">Checked:</span> {health.checkedAt || '—'}</p>
              <p><span className="text-gray-500">Memory RSS:</span> {memory.rssMb ?? '—'} MB</p>
              <p><span className="text-gray-500">Heap Total:</span> {memory.heapTotalMb ?? '—'} MB</p>
            </div>
          )}
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>ML Metrics</Card.Title>
          </Card.Header>
          {isLoading ? (
            <div className="h-36 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Calls:</span> {formatNumber(ml?.metrics?.calls || 0)}</p>
              <p><span className="text-gray-500">Failures:</span> {formatNumber(ml?.metrics?.failures || 0)}</p>
              <p><span className="text-gray-500">Fallback Calls:</span> {formatNumber(ml?.metrics?.fallbackCalls || 0)}</p>
              <p><span className="text-gray-500">Fallback Rate:</span> {ml?.metrics?.fallbackRate ?? 0}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
