import { useState } from 'react'

export default function Tabs({ tabs, defaultTab, className = '' }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.key)

  return (
    <div className={className}>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors relative
              ${active === tab.key
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            {tab.label}
            {active === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </div>
  )
}
