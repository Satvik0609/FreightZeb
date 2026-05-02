import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from '@/lib/queryClient'
import { useThemeStore } from '@/store/themeStore'
import ProtectedRoute, { AdminRoute, RoleRoute } from '@/features/auth/ProtectedRoute'
import Layout from '@/components/layout/Layout'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

// Auth pages (not lazy — small)
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'

// Lazy-load all main pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ShipmentsPage = lazy(() => import('@/pages/ShipmentsPage'))
const ShipmentDetailPage = lazy(() => import('@/pages/ShipmentDetailPage'))
const TrucksPage = lazy(() => import('@/pages/TrucksPage'))
const BookingsPage = lazy(() => import('@/pages/BookingsPage'))
const BookingDetailPage = lazy(() => import('@/pages/BookingDetailPage'))
const TrackingPage = lazy(() => import('@/pages/TrackingPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const EarningsPage = lazy(() => import('@/pages/EarningsPage'))
const MLInsightsPage = lazy(() => import('@/pages/MLInsightsPage'))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'))
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'))
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const FinancePage = lazy(() => import('@/pages/admin/FinancePage'))
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'))
const SystemHealthPage = lazy(() => import('@/pages/admin/SystemHealthPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

function ThemeInitializer() {
  const { theme } = useThemeStore()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeInitializer />
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={
                  <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>
                } />
                <Route path="/shipments" element={
                  <RoleRoute allowedRoles={['ADMIN', 'WAREHOUSE']}>
                    <Suspense fallback={<PageLoader />}><ShipmentsPage /></Suspense>
                  </RoleRoute>
                } />
                <Route path="/shipments/:id" element={
                  <RoleRoute allowedRoles={['ADMIN', 'WAREHOUSE']}>
                    <Suspense fallback={<PageLoader />}><ShipmentDetailPage /></Suspense>
                  </RoleRoute>
                } />
                <Route path="/trucks" element={
                  <Suspense fallback={<PageLoader />}><TrucksPage /></Suspense>
                } />
                <Route path="/bookings" element={
                  <Suspense fallback={<PageLoader />}><BookingsPage /></Suspense>
                } />
                <Route path="/bookings/:id" element={
                  <Suspense fallback={<PageLoader />}><BookingDetailPage /></Suspense>
                } />
                <Route path="/tracking" element={
                  <Suspense fallback={<PageLoader />}><TrackingPage /></Suspense>
                } />
                <Route path="/analytics" element={
                  <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>
                } />
                <Route path="/earnings" element={
                  <RoleRoute allowedRoles={['DEALER', 'ADMIN']}>
                    <Suspense fallback={<PageLoader />}><EarningsPage /></Suspense>
                  </RoleRoute>
                } />
                <Route path="/ml-insights" element={
                  <Suspense fallback={<PageLoader />}><MLInsightsPage /></Suspense>
                } />
                <Route path="/notifications" element={
                  <Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>
                } />
                <Route path="/invoices" element={
                  <RoleRoute allowedRoles={['ADMIN', 'WAREHOUSE']}>
                    <Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>
                  </RoleRoute>
                } />
                <Route path="/admin/users" element={
                  <AdminRoute>
                    <Suspense fallback={<PageLoader />}><UsersPage /></Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/dashboard" element={
                  <AdminRoute>
                    <Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/finance" element={
                  <AdminRoute>
                    <Suspense fallback={<PageLoader />}><FinancePage /></Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/audit-logs" element={
                  <AdminRoute>
                    <Suspense fallback={<PageLoader />}><AuditLogsPage /></Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/system-health" element={
                  <AdminRoute>
                    <Suspense fallback={<PageLoader />}><SystemHealthPage /></Suspense>
                  </AdminRoute>
                } />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--toast-bg, #fff)',
              color: 'var(--toast-color, #111827)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
