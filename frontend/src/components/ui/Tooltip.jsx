import { useState } from 'react'

export default function Tooltip({ children, content, position = 'top' }) {
  const [visible, setVisible] = useState(false)

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className="relative inline-flex" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && content && (
        <div className={`absolute z-50 ${positions[position]} pointer-events-none`}>
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}
