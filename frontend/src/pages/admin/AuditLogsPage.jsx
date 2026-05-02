import { useQuery } from '@tanstack/react-query'
import { adminService } from '@/services/admin.service'
import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/utils/formatters'

export default function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => adminService.getAuditLogs(100),
    staleTime: 30 * 1000,
  })

  const logs = data?.logs || []

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="Who changed what and when across platform operations" />

      <Card>
        <Card.Header>
          <Card.Title>Recent Audit Trail</Card.Title>
        </Card.Header>
        {isLoading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No audit events available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Actor</th>
                  <th className="py-2 pr-4 font-medium">Subject</th>
                  <th className="py-2 pr-0 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatDateTime(row.timestamp)}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{row.action}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{row.actor}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{row.subject}</td>
                    <td className="py-2 pr-0 text-gray-600 dark:text-gray-300">{row.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
