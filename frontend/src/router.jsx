import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAuthStore } from "./store/authStore";
import { LoadingGrid } from "./components/ui/primitives";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const ShipmentDetailPage = lazy(() => import("./pages/ShipmentDetailPage"));
const TrucksPage = lazy(() => import("./pages/TrucksPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const BookingDetailPage = lazy(() => import("./pages/BookingDetailPage"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const MlInsightsPage = lazy(() => import("./pages/MlInsightsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

function PageFallback() {
  return <LoadingGrid count={4} />;
}

function Protected({ children, roles }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<PageFallback />}>
        <AuthPage mode="login" />
      </Suspense>
    ),
  },
  {
    path: "/register",
    element: (
      <Suspense fallback={<PageFallback />}>
        <AuthPage mode="register" />
      </Suspense>
    ),
  },
  {
    path: "/forgot-password",
    element: (
      <Suspense fallback={<PageFallback />}>
        <AuthPage mode="forgot" />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: (
      <Protected>
        <AppShell />
      </Protected>
    ),
    children: [
      { index: true, element: <Protected><DashboardPage /></Protected> },
      { path: "shipments", element: <Protected roles={["ADMIN", "WAREHOUSE"]}><ShipmentsPage /></Protected> },
      { path: "shipments/:id", element: <Protected roles={["ADMIN", "WAREHOUSE"]}><ShipmentDetailPage /></Protected> },
      { path: "trucks", element: <Protected><TrucksPage /></Protected> },
      { path: "bookings", element: <Protected><BookingsPage /></Protected> },
      { path: "bookings/:id", element: <Protected><BookingDetailPage /></Protected> },
      { path: "tracking", element: <Protected><TrackingPage /></Protected> },
      { path: "analytics", element: <Protected><AnalyticsPage /></Protected> },
      { path: "ml-insights", element: <Protected><MlInsightsPage /></Protected> },
      { path: "notifications", element: <Protected><NotificationsPage /></Protected> },
      { path: "invoices", element: <Protected roles={["ADMIN", "WAREHOUSE"]}><InvoicesPage /></Protected> },
      { path: "admin", element: <Protected roles={["ADMIN"]}><AdminPage /></Protected> },
    ],
  },
]);
