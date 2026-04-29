import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  return useAuthStore()
}

export function useRole() {
  const { user } = useAuthStore()
  return {
    role: user?.role,
    isAdmin: user?.role === 'ADMIN',
    isWarehouse: user?.role === 'WAREHOUSE',
    isDealer: user?.role === 'DEALER',
    can: (roles) => roles.includes(user?.role),
  }
}
