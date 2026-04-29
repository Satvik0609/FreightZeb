export default function ProgressBar({ value = 0, max = 100, color = 'blue', label, showValue = false, size = 'md' }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  }

  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-500 ${colors[color] || color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
