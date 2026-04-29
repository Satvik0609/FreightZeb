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
