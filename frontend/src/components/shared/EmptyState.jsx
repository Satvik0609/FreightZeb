import { PackageOpen } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function EmptyState({ icon: Icon = PackageOpen, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{description}</p>}
      {action && actionLabel && (
        <Button onClick={action} size="sm">{actionLabel}</Button>
      )}
    </div>
  )
}
