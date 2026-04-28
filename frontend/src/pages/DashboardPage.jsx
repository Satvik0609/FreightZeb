import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRightLeft, BrainCircuit, Receipt, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { analyticsService } from "../services/analyticsService";
import { mlService } from "../services/mlService";
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
            { title: "Fleet Size", value: analytics.totalTrucks || 0, hint: "Registered trucks", icon: Truck },
            { title: "Delivered KM", value: formatNumber(analytics.totalDeliveredKm), hint: "Completed bookings", icon: ArrowRightLeft },
            { title: "Optimization Score", value: analytics.avgOptimizationScore ?? "—", hint: "Average delivered score", icon: BrainCircuit },
            { title: "Fleet Utilization", value: percent(analytics.fleetUtilizationPct), hint: "Booked or moving trucks", icon: Activity },
          ]
        : [
            { title: "Shipments", value: analytics.totalShipments || 0, hint: "Created by your warehouse", icon: ArrowRightLeft },
            { title: "Delivered", value: analytics.deliveredCount || 0, hint: "Completed consignments", icon: Receipt },
            { title: "Avg ETA", value: analytics.avgEtaHours ? `${analytics.avgEtaHours} h` : "—", hint: "Prediction-backed", icon: BrainCircuit },
            { title: "CO2 Insight", value: `${formatNumber(analytics.totalCo2SavedKg)} kg`, hint: "Saved estimate", icon: Activity },
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
          <CardHeader title="ML service" subtitle="Backend health proxy and readiness" />
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Circuit</div>
              <div className="mt-2 text-lg font-semibold">{mlHealthQuery.data?.circuit?.state || "unknown"}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Readiness</div>
              <div className="mt-2 text-lg font-semibold">{String(mlHealthQuery.data?.readyz?.ready ?? "n/a")}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Health</div>
              <div className="mt-2 text-lg font-semibold">{mlHealthQuery.data?.health?.status || "unknown"}</div>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
