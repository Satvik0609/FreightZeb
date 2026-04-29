import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRightLeft, BrainCircuit, Receipt, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { analyticsService } from "../services/analyticsService";
import { mlService } from "../services/mlService";
import { truckService } from "../services/truckService";
import { shipmentService } from "../services/shipmentService";
import { useAuthStore } from "../store/authStore";
import { Button, Card, CardHeader, EmptyState, LoadingGrid, Page, ProgressBar, StatCard, StatusBadge } from "../components/ui/primitives";
import { formatNumber, percent } from "../lib/utils";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const summaryQuery = useQuery({
    queryKey: ["dashboard", user?.role],
    queryFn: () => {
      if (user?.role === "ADMIN") return analyticsService.adminSummary();
      if (user?.role === "DEALER") return analyticsService.dealerSummary();
      return analyticsService.warehouseSummary();
    },
  });

  // Cross-role context queries
  const availableTrucksQuery = useQuery({
    queryKey: ["dashboard-available-trucks"],
    queryFn: () => truckService.listAvailable({}),
    enabled: user?.role === "WAREHOUSE" || user?.role === "CARGO_DEALER",
    staleTime: 30_000,
  });
  const availableShipmentsQuery = useQuery({
    queryKey: ["dashboard-available-shipments"],
    queryFn: () => shipmentService.listAvailable({ status: "PENDING" }),
    enabled: user?.role === "DEALER",
    staleTime: 30_000,
  });

  const mlHealthQuery = useQuery({
    queryKey: ["ml-health"],
    queryFn: mlService.health,
    staleTime: 20000,
  });

  if (summaryQuery.isLoading) return <LoadingGrid count={4} />;
  if (summaryQuery.isError) return <EmptyState title="Dashboard unavailable" message={summaryQuery.error.message} />;

  const analytics = summaryQuery.data?.analytics || {};
  const cards =
    user?.role === "ADMIN"
      ? [
        { title: "Users", value: analytics.users?.total || 0, hint: "Active platform accounts", icon: Activity },
        { title: "Shipments", value: analytics.shipments?.total || 0, hint: "Across all warehouses", icon: ArrowRightLeft },
        { title: "Bookings", value: analytics.bookings?.total || 0, hint: "Lifecycle events", icon: Receipt },
        { title: "Delivered KM", value: formatNumber(analytics.totalDeliveredKm), hint: "Completed distance", icon: Truck },
      ]
      : user?.role === "DEALER"
        ? [
          { title: "My Fleet", value: analytics.totalTrucks || 0, hint: "Registered trucks", icon: Truck },
          { title: "Pending Shipments", value: availableShipmentsQuery.data?.total || 0, hint: "Bookable from warehouses", icon: ArrowRightLeft },
          { title: "Optimization Score", value: analytics.avgOptimizationScore ?? "—", hint: "Average delivered score", icon: BrainCircuit },
          { title: "Fleet Utilization", value: percent(analytics.fleetUtilizationPct), hint: "Booked or moving trucks", icon: Activity },
        ]
        : [
          { title: "My Shipments", value: analytics.totalShipments || 0, hint: "Created by your account", icon: ArrowRightLeft },
          { title: "Available Trucks", value: availableTrucksQuery.data?.total || 0, hint: "Ready to book now", icon: Truck },
          { title: "Delivered", value: analytics.deliveredCount || 0, hint: "Completed consignments", icon: Receipt },
          { title: "Avg ETA", value: analytics.avgEtaHours ? `${analytics.avgEtaHours} h` : "—", hint: "ML prediction-backed", icon: BrainCircuit },
        ];

  const statusSource =
    analytics.byStatus ||
    analytics.bookings?.byStatus ||
    analytics.trucksByStatus ||
    analytics.shipments?.byStatus ||
    {};

  return (
    <Page
      title="Dashboard"
      subtitle="Role-specific operational summary backed by live backend analytics."
      actions={<Button as={Link} to="/ml-insights">Open ML workspace</Button>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <StatCard key={card.title} {...card} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader title="Status distribution" subtitle="Current workload by backend state" />
          <div className="space-y-4">
            {Object.entries(statusSource).map(([status, count]) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    <span className="text-sm text-slate-500 dark:text-slate-400">{count} records</span>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
                <ProgressBar value={Math.min(100, (Number(count) / Math.max(...Object.values(statusSource), 1)) * 100)} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="ML service" subtitle="7 models trained on real Kaggle data" />
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Circuit Breaker</div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex h-2 w-2 rounded-full ${mlHealthQuery.data?.circuit?.open ? "bg-red-500" : "bg-emerald-500"}`} />
                <span className="text-lg font-semibold">{mlHealthQuery.data?.circuit?.open ? "Open" : "Closed"}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{mlHealthQuery.data?.circuit?.failures || 0} failures</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Service Status</div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex h-2 w-2 rounded-full ${mlHealthQuery.data?.readyz?.ready ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-lg font-semibold">{mlHealthQuery.data?.readyz?.ready ? "Ready" : "Loading"}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{mlHealthQuery.data?.health?.status || "unknown"}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Models Loaded</div>
              <div className="mt-2 text-lg font-semibold">{mlHealthQuery.data?.readyz?.models_loaded?.length || 0} / 7</div>
              <div className="mt-1 text-xs text-slate-400">Truck, Delivery, Fuel, Delay, Cluster, Route, Cargo</div>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
