import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useSocket } from '@/hooks/useSocket'
import { useThemeStore } from '@/store/themeStore'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { theme } = useThemeStore()

  useSocket()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed((v) => !v)}
      />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <Navbar onMenuClick={() => setSidebarCollapsed((v) => !v)} />
        <main className="pt-16 min-h-screen">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
