import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Truck, BookOpen, MapPin,
  BarChart2, Brain, FileText, Users, ChevronLeft, Zap, Bell, Wallet, ShieldCheck, Activity
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'WAREHOUSE', 'DEALER'], section: 'Operations' },
  { path: '/shipments', icon: Package, label: 'Shipments', roles: ['ADMIN', 'WAREHOUSE'], section: 'Operations' },
  { path: '/trucks', icon: Truck, label: 'Trucks', roles: ['ADMIN', 'DEALER'], section: 'Operations' },
  { path: '/bookings', icon: BookOpen, label: 'Bookings', roles: ['ADMIN', 'WAREHOUSE', 'DEALER'], section: 'Operations' },
  { path: '/tracking', icon: MapPin, label: 'Live Tracking', roles: ['ADMIN', 'WAREHOUSE', 'DEALER'], section: 'Operations' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics', roles: ['ADMIN', 'WAREHOUSE', 'DEALER'], section: 'Operations' },
  { path: '/earnings', icon: Wallet, label: 'Dealer Earnings', roles: ['ADMIN', 'DEALER'], section: 'Operations' },
  { path: '/ml-insights', icon: Brain, label: 'ML Insights', roles: ['ADMIN', 'WAREHOUSE', 'DEALER'], section: 'Operations' },
  { path: '/notifications', icon: Bell, label: 'Notifications', roles: ['ADMIN', 'WAREHOUSE', 'DEALER'], section: 'Operations' },
  { path: '/invoices', icon: FileText, label: 'Invoices', roles: ['ADMIN', 'WAREHOUSE'], section: 'Operations' },
  { path: '/admin/users', icon: Users, label: 'Users', roles: ['ADMIN'], section: 'Administration' },
  { path: '/admin/dashboard', icon: ShieldCheck, label: 'Admin Dashboard', roles: ['ADMIN'], section: 'Administration' },
  { path: '/admin/finance', icon: Wallet, label: 'Finance Ops', roles: ['ADMIN'], section: 'Administration' },
  { path: '/admin/audit-logs', icon: FileText, label: 'Audit Logs', roles: ['ADMIN'], section: 'Administration' },
  { path: '/admin/system-health', icon: Activity, label: 'System Health', roles: ['ADMIN'], section: 'Administration' },
]

export default function Sidebar({ collapsed, onCollapse }) {
  const { user } = useAuthStore()

  const filtered = navItems.filter((item) => item.roles.includes(user?.role))
  const isAdmin = user?.role === 'ADMIN'

  return (
    <aside className={`
      fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-30 flex flex-col
      ${collapsed ? 'w-16' : 'w-64'}
    `}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">FreightZeb</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mx-auto">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={onCollapse}
          className={`p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors ${collapsed ? 'hidden' : ''}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {filtered.map((item, idx) => {
          const showSection = isAdmin && !collapsed && (idx === 0 || filtered[idx - 1].section !== item.section)
          return (
            <div key={item.path}>
              {showSection && (
                <p className="px-3 mb-2 mt-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  {item.section}
                </p>
              )}
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150 group relative
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }
            `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-xl border border-gray-700 z-50">
                        {item.label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-700/50">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role}</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold mx-auto">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
    </aside>
  )
}
