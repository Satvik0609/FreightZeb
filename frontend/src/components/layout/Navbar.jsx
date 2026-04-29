import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useNotificationStore } from '@/store/notificationStore'
import NotificationBell from '@/features/notifications/NotificationBell'

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20 h-16 flex items-center px-4 gap-4 shadow-sm transition-all duration-300">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <button
        onClick={toggle}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <NotificationBell />

      <div className="relative">
        <button
          onClick={() => setShowUserMenu((v) => !v)}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            <button
              onClick={() => { navigate('/profile'); setShowUserMenu(false) }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <User className="w-4 h-4" /> Profile
            </button>
            <hr className="my-1 border-gray-100 dark:border-gray-700" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
