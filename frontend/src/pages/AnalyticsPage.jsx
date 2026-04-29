import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { analyticsService } from "../services/analyticsService";
import { useAuthStore } from "../store/authStore";
import { formatNumber, formatCurrency, cn } from "../lib/utils";
import { Card, CardHeader, Page, Segmented, StatCard, ProgressBar } from "../components/ui/primitives";
import {
  TrendingUp, TrendingDown, Package, Truck, Route,
  Leaf, Clock, BarChart3, Zap, Activity,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const PALETTE = {
  blue: "#2563eb",
  indigo: "#6366f1",
  violet: "#7c3aed",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  slate: "#94a3b8",
};

const STATUS_COLORS = {
  PENDING: PALETTE.amber,
  OPTIMIZED: PALETTE.cyan,
  BOOKED: PALETTE.blue,
  IN_TRANSIT: PALETTE.indigo,
  DELIVERED: PALETTE.emerald,
  CANCELLED: PALETTE.rose,
  AVAILABLE: PALETTE.emerald,
  MAINTENANCE: PALETTE.amber,
  REQUESTED: PALETTE.amber,
  APPROVED: PALETTE.blue,
  ASSIGNED: PALETTE.indigo,
  REJECTED: PALETTE.rose,
};

const AREA_GRADIENTS = [
  { id: "g1", color: PALETTE.blue },
  { id: "g2", color: PALETTE.indigo },
  { id: "g3", color: PALETTE.emerald },
  { id: "g4", color: PALETTE.violet },
];

/* ── Shared tooltip ─────────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
      <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: entry.color }}>{formatNumber(entry.value)}{unit}</span>
          {entry.name !== "value" && <span className="text-slate-400 font-normal">{entry.name}</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Donut chart ────────────────────────────────────────────────────────────── */
function DonutChart({ data, title, subtitle, total }) {
  const [active, setActive] = useState(null);
  if (!data?.length) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-52 w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={60} outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.name] || Object.values(PALETTE)[i % 8]}
                  opacity={active === null || active === i ? 1 : 0.4}
                  stroke="none"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{active !== null ? data[active]?.value : total ?? data.reduce((s, d) => s + d.value, 0)}</span>
          <span className="text-xs text-slate-400">{active !== null ? data[active]?.name : "total"}</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[entry.name] || Object.values(PALETTE)[i % 8] }} />
            <span className="text-slate-500 dark:text-slate-400">{entry.name.replace(/_/g, " ")}</span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sparkline area chart ───────────────────────────────────────────────────── */
function SparkArea({ data, color = PALETTE.blue, unit = "", height = 200 }) {
  if (!data?.length) return <div className="flex h-full items-center justify-center text-sm text-slate-400">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={36} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Area
          type="monotone" dataKey="value"
          stroke={color} strokeWidth={2.5}
          fill={`url(#sg-${color.replace("#", "")})`}
          dot={false} activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Bar chart ──────────────────────────────────────────────────────────────── */
function StyledBar({ data, color = PALETTE.blue, unit = "", height = 200 }) {
  if (!data?.length) return <div className="flex h-full items-center justify-center text-sm text-slate-400">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={36} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Multi-line chart ───────────────────────────────────────────────────────── */
function MultiLine({ series, height = 220 }) {
  if (!series?.length || !series[0]?.data?.length) return <div className="flex h-full items-center justify-center text-sm text-slate-400">No data yet</div>;
  // Merge all series by bucket
  const buckets = [...new Set(series.flatMap((s) => s.data.map((d) => d.bucket)))].sort();
  const merged = buckets.map((bucket) => {
    const row = { bucket };
    series.forEach((s) => {
      const found = s.data.find((d) => d.bucket === bucket);
      row[s.key] = found?.value ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={36} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Line
            key={s.key} type="monotone" dataKey={s.key}
            stroke={s.color} strokeWidth={2.5}
            dot={false} activeDot={{ r: 5, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Trend badge ────────────────────────────────────────────────────────────── */
function Trend({ data }) {
  if (!data?.length || data.length < 2) return null;
  const last = data[data.length - 1]?.value ?? 0;
  const prev = data[data.length - 2]?.value ?? 0;
  if (prev === 0) return null;
  const pct = (((last - prev) / prev) * 100).toFixed(1);
  const up = last >= prev;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", up ? "text-emerald-600" : "text-rose-500")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

/* ── Section label ──────────────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   WAREHOUSE VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function WarehouseAnalytics({ summary, charts }) {
  const byStatus = useMemo(() =>
    Object.entries(summary?.byStatus || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Shipments" value={formatNumber(summary?.totalShipments)} hint="All time" icon={Package} />
        <StatCard title="Delivered" value={formatNumber(summary?.deliveredCount)} hint={`${formatNumber(summary?.totalDistanceKm)} km covered`} icon={Route} />
        <StatCard title="Avg ETA" value={summary?.avgEtaHours ? `${summary.avgEtaHours}h` : "—"} hint="ML predicted" icon={Clock} />
        <StatCard title="CO₂ Saved" value={summary?.totalCo2SavedKg ? `${formatNumber(summary.totalCo2SavedKg)} kg` : "—"} hint="Via route optimization" icon={Leaf} />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Shipment status donut */}
        <Card>
          <CardHeader eyebrow="Breakdown" title="Shipments by status" />
          <DonutChart data={byStatus} total={summary?.totalShipments} />
        </Card>

        {/* Shipments created trend */}
        <Card className="xl:col-span-2">
          <CardHeader
            eyebrow="30-day trend"
            title="Shipments created"
            actions={<Trend data={charts?.shipmentsCreated} />}
          />
          <SparkArea data={charts?.shipmentsCreated} color={PALETTE.blue} height={220} />
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Deliveries" title="Distance covered (km)" actions={<Trend data={charts?.deliveredDistanceKm} />} />
          <StyledBar data={charts?.deliveredDistanceKm} color={PALETTE.indigo} unit=" km" height={200} />
        </Card>

        <Card>
          <CardHeader eyebrow="ML predictions" title="ETA vs Fuel estimates" />
          <MultiLine
            height={200}
            series={[
              { key: "ETA (h)", color: PALETTE.violet, data: charts?.etaHours || [] },
              { key: "Fuel (L)", color: PALETTE.emerald, data: charts?.fuelEstimateLiters || [] },
            ]}
          />
        </Card>
      </div>

      {/* CO2 */}
      {charts?.co2Kg?.length > 0 && (
        <Card>
          <CardHeader eyebrow="Sustainability" title="CO₂ offset over time (kg)" actions={<Trend data={charts?.co2Kg} />} />
          <SparkArea data={charts?.co2Kg} color={PALETTE.emerald} unit=" kg" height={180} />
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DEALER VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function DealerAnalytics({ summary, charts }) {
  const truckStatus = useMemo(() =>
    Object.entries(summary?.trucksByStatus || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );
  const bookingStatus = useMemo(() =>
    Object.entries(summary?.bookingsByStatus || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Fleet Size" value={formatNumber(summary?.totalTrucks)} hint="Registered trucks" icon={Truck} />
        <StatCard title="Fleet Utilization" value={`${summary?.fleetUtilizationPct ?? 0}%`} hint="Non-available trucks" icon={Activity} />
        <StatCard title="Total KM Delivered" value={formatNumber(summary?.totalDeliveredKm)} hint="Across all trips" icon={Route} />
        <StatCard title="Avg Optim Score" value={summary?.avgOptimizationScore ? (summary.avgOptimizationScore * 100).toFixed(1) + "%" : "—"} hint="ML match quality" icon={Zap} />
      </div>

      {/* Utilization gauge + donuts */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Fleet" title="Trucks by status" />
          <DonutChart data={truckStatus} total={summary?.totalTrucks} />
        </Card>

        <Card>
          <CardHeader eyebrow="Bookings" title="Bookings by status" />
          <DonutChart data={bookingStatus} />
        </Card>

        <Card>
          <CardHeader eyebrow="Utilization" title="Fleet efficiency" />
          <div className="space-y-4 pt-2">
            <ProgressBar value={summary?.fleetUtilizationPct} label="Fleet utilization" />
            {truckStatus.map((s) => (
              <ProgressBar
                key={s.name}
                value={summary?.totalTrucks ? (s.value / summary.totalTrucks) * 100 : 0}
                label={s.name.replace(/_/g, " ")}
                tone={s.name === "AVAILABLE" ? "from-emerald-500 to-teal-400" : s.name === "IN_TRANSIT" ? "from-indigo-500 to-violet-500" : "from-amber-400 to-orange-400"}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Trend charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="30-day trend" title="Bookings created" actions={<Trend data={charts?.bookingsCreated} />} />
          <SparkArea data={charts?.bookingsCreated} color={PALETTE.blue} height={200} />
        </Card>

        <Card>
          <CardHeader eyebrow="Revenue proxy" title="Distance delivered (km)" actions={<Trend data={charts?.deliveredDistanceKm} />} />
          <StyledBar data={charts?.deliveredDistanceKm} color={PALETTE.indigo} unit=" km" height={200} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="ML quality" title="Optimization score trend" />
          <SparkArea data={charts?.optimizationScore} color={PALETTE.violet} height={180} />
        </Card>

        <Card>
          <CardHeader eyebrow="Growth" title="Trucks added over time" />
          <StyledBar data={charts?.trucksAdded} color={PALETTE.emerald} height={180} />
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function AdminAnalytics({ summary, charts }) {
  const shipmentStatus = useMemo(() =>
    Object.entries(summary?.shipments?.byStatus || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );
  const bookingStatus = useMemo(() =>
    Object.entries(summary?.bookings?.byStatus || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );
  const truckStatus = useMemo(() =>
    Object.entries(summary?.trucks?.byStatus || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );
  const userRoles = useMemo(() =>
    Object.entries(summary?.users?.byRole || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Users" value={formatNumber(summary?.users?.total)} hint="Platform-wide" icon={Activity} />
        <StatCard title="Shipments" value={formatNumber(summary?.shipments?.total)} hint="All time" icon={Package} />
        <StatCard title="Trucks" value={formatNumber(summary?.trucks?.total)} hint="Registered fleet" icon={Truck} />
        <StatCard title="KM Delivered" value={formatNumber(summary?.totalDeliveredKm)} hint="Total distance" icon={Route} />
      </div>

      {/* Donuts row */}
      <div className="grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader eyebrow="Users" title="By role" />
          <DonutChart data={userRoles} total={summary?.users?.total} />
        </Card>
        <Card>
          <CardHeader eyebrow="Shipments" title="By status" />
          <DonutChart data={shipmentStatus} total={summary?.shipments?.total} />
        </Card>
        <Card>
          <CardHeader eyebrow="Bookings" title="By status" />
          <DonutChart data={bookingStatus} total={summary?.bookings?.total} />
        </Card>
        <Card>
          <CardHeader eyebrow="Fleet" title="By status" />
          <DonutChart data={truckStatus} total={summary?.trucks?.total} />
        </Card>
      </div>

      {/* Platform growth multi-line */}
      <Card>
        <CardHeader eyebrow="Platform growth" title="Users · Shipments · Bookings over time" />
        <MultiLine
          height={260}
          series={[
            { key: "Users", color: PALETTE.blue, data: charts?.usersRegistered || [] },
            { key: "Shipments", color: PALETTE.indigo, data: charts?.shipmentsCreated || [] },
            { key: "Bookings", color: PALETTE.violet, data: charts?.bookingsCreated || [] },
          ]}
        />
      </Card>

      {/* Distance + CO2 */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Logistics volume" title="Distance delivered (km)" actions={<Trend data={charts?.deliveredDistanceKm} />} />
          <StyledBar data={charts?.deliveredDistanceKm} color={PALETTE.indigo} unit=" km" height={200} />
        </Card>
        <Card>
          <CardHeader eyebrow="Sustainability" title="CO₂ offset (kg)" actions={<Trend data={charts?.co2Kg} />} />
          <SparkArea data={charts?.co2Kg} color={PALETTE.emerald} unit=" kg" height={200} />
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const [days, setDays] = useState("30");

  const summaryQuery = useQuery({
    queryKey: ["analytics-summary", user?.role],
    queryFn: () => {
      if (user?.role === "ADMIN") return analyticsService.adminSummary();
      if (user?.role === "DEALER") return analyticsService.dealerSummary();
      return analyticsService.warehouseSummary();
    },
  });

  const chartsQuery = useQuery({
    queryKey: ["analytics-charts", user?.role, days],
    queryFn: () => {
      const params = { days: Number(days), granularity: Number(days) <= 30 ? "day" : "week" };
      if (user?.role === "ADMIN") return analyticsService.adminCharts(params);
      if (user?.role === "DEALER") return analyticsService.dealerCharts(params);
      return analyticsService.warehouseCharts(params);
    },
  });

  const summary = summaryQuery.data?.analytics ?? summaryQuery.data;
  const charts = chartsQuery.data?.charts || {};
  const loading = summaryQuery.isLoading || chartsQuery.isLoading;

  const roleLabel = user?.role === "ADMIN" ? "Platform" : user?.role === "DEALER" ? "Fleet & Bookings" : "Shipments";

  return (
    <Page
      title="Analytics"
      subtitle={`${roleLabel} performance dashboard — live data from your account.`}
      actions={
        <Segmented
          value={days}
          onChange={setDays}
          items={[
            { label: "7d", value: "7" },
            { label: "30d", value: "30" },
            { label: "90d", value: "90" },
          ]}
        />
      }
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="panel p-6 space-y-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-8 w-32" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      ) : user?.role === "ADMIN" ? (
        <AdminAnalytics summary={summary} charts={charts} />
      ) : user?.role === "DEALER" ? (
        <DealerAnalytics summary={summary} charts={charts} />
      ) : (
        <WarehouseAnalytics summary={summary} charts={charts} />
      )}
    </Page>
  );
}
