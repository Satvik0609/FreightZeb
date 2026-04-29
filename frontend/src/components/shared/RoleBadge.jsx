import Badge from '@/components/ui/Badge'

const ROLE_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  WAREHOUSE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  DEALER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
}

export default function RoleBadge({ role, size = 'md' }) {
  return (
    <Badge className={ROLE_COLORS[role] || 'bg-gray-100 text-gray-700'} size={size}>
      {role}
    </Badge>
  )
}
