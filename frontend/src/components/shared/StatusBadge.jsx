import Badge from '@/components/ui/Badge'
import { STATUS_COLORS } from '@/utils/constants'
import { formatStatus } from '@/utils/formatters'

export default function StatusBadge({ status, size = 'md' }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
  return (
    <Badge className={colorClass} size={size} dot>
      {formatStatus(status)}
    </Badge>
  )
}
