import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AdminRoute({ children }) {
  const { user } = useAuthStore()
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return children
}

export function RoleRoute({ children, allowedRoles = [] }) {
  const { user } = useAuthStore()
  const isAllowed = allowedRoles.includes(user?.role)
  if (!isAllowed) return <Navigate to="/" replace />
  return children
}
