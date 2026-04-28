import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, Line, LineChart } from "recharts";
import { analyticsService } from "../services/analyticsService";
import { useAuthStore } from "../store/authStore";
import { Card, CardHeader, Page } from "../components/ui/primitives";

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const chartsQuery = useQuery({
    queryKey: ["analytics-charts", user?.role],
    queryFn: () => {
      const params = { days: 30, granularity: "day" };
      if (user?.role === "ADMIN") return analyticsService.adminCharts(params);
      if (user?.role === "DEALER") return analyticsService.dealerCharts(params);
      return analyticsService.warehouseCharts(params);
    },
  });

  const charts = chartsQuery.data?.charts || {};
  const primary = charts.shipmentsCreated || charts.bookingsCreated || charts.usersRegistered || [];
  const secondary = charts.deliveredDistanceKm || charts.etaHours || charts.optimizationScore || [];

  return (
    <Page title="Analytics" subtitle="Trend views sourced from the exact role-specific analytics endpoints.">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Primary volume trend" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={primary}>
                <defs>
                  <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#primaryGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Distance and prediction trend" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={secondary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Auxiliary series" subtitle="Rendered only from returned chart keys." />
          <div className="grid gap-6 xl:grid-cols-3">
            {Object.entries(charts).slice(0, 3).map(([key, data]) => (
              <div key={key} className="h-64 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <div className="mb-3 font-medium">{key}</div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="bucket" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
