import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CheckCircle2, IndianRupee, PackageCheck, Route, Truck } from "lucide-react";
import { bookingService } from "../services/bookingService";
import { useAuthStore } from "../store/authStore";
import { activeBookingFlow, bookingStatuses, formatCurrency, formatDate, formatNumber } from "../lib/utils";
import { Card, CardHeader, DataTable, EmptyState, Page, Select, StatCard, StatusBadge } from "../components/ui/primitives";
import { getSocket } from "../lib/socket";

const activeStatuses = ["REQUESTED", "APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"];

function getPartyLabel(userRole, row) {
  if (userRole === "DEALER") return row.warehouse?.company || row.warehouse?.name || "-";
  if (userRole === "WAREHOUSE" || userRole === "CARGO_DEALER") return row.dealer?.company || row.dealer?.name || "-";
  return `${row.warehouse?.company || row.warehouse?.name || "Warehouse"} / ${row.dealer?.company || row.dealer?.name || "Dealer"}`;
}

function getPrimaryActionHint(userRole, status) {
  if (userRole === "DEALER") {
    if (status === "REQUESTED") return "Approve or reject";
    if (status === "APPROVED") return "Assign truck";
    if (status === "ASSIGNED") return "Mark picked up";
    if (status === "PICKED_UP") return "Start transit";
    if (status === "IN_TRANSIT") return "Mark delivered";
  }
  if ((userRole === "WAREHOUSE" || userRole === "CARGO_DEALER") && ["REQUESTED", "APPROVED", "ASSIGNED"].includes(status)) {
    return "Cancelable";
  }
  if (userRole === "ADMIN" && !["DELIVERED", "CANCELLED", "REJECTED"].includes(status)) return "Admin action";
  return "No action";
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["bookings", user?.role, status],
    queryFn: () =>
      user?.role === "ADMIN"
        ? bookingService.listAll({ status: status || undefined })
        : user?.role === "DEALER"
          ? bookingService.listDealer({ status: status || undefined })
          : bookingService.listMine({ status: status || undefined }),
  });

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bookings"] });
    socket.on("booking:statusUpdate", invalidate);
    socket.on("shipment:statusUpdate", invalidate);
    return () => {
      socket.off("booking:statusUpdate", invalidate);
      socket.off("shipment:statusUpdate", invalidate);
    };
  }, [token, queryClient]);

  const rows = bookingsQuery.data?.items || [];
  const summary = useMemo(() => {
    const totalValue = rows.reduce((sum, row) => sum + Number(row.pricing?.total || 0), 0);
    const totalDistance = rows.reduce((sum, row) => sum + Number(row.distanceKm || 0), 0);
    return {
      total: bookingsQuery.data?.total ?? rows.length,
      pending: rows.filter((row) => row.status === "REQUESTED").length,
      active: rows.filter((row) => activeStatuses.includes(row.status)).length,
      delivered: rows.filter((row) => row.status === "DELIVERED").length,
      totalValue,
      totalDistance,
    };
  }, [rows, bookingsQuery.data?.total]);

  const columns = useMemo(
    () => [
      {
        key: "booking",
        label: "Booking",
        render: (row) => (
          <div className="min-w-52">
            <div className="font-medium">{row.id.slice(0, 8)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{row.shipment?.description || "Shipment request"}</div>
          </div>
        ),
      },
      { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
      { key: "party", label: user?.role === "ADMIN" ? "Parties" : user?.role === "DEALER" ? "Warehouse" : "Dealer", render: (row) => getPartyLabel(user?.role, row) },
      { key: "truck", label: "Truck", render: (row) => row.truck?.registrationNo || "-" },
      { key: "distanceKm", label: "Distance", render: (row) => row.distanceKm ? `${formatNumber(row.distanceKm)} km` : "-" },
      { key: "pricing", label: "Total", render: (row) => formatCurrency(row.pricing?.total) },
      { key: "next", label: "Next", render: (row) => getPrimaryActionHint(user?.role, row.status) },
      { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt, "dd MMM, HH:mm") },
    ],
    [user?.role],
  );

  return (
    <Page
      title="Bookings"
      subtitle={
        user?.role === "DEALER"
          ? "Requests for your trucks, ordered for approval and trip execution."
          : user?.role === "ADMIN"
            ? "Platform-wide booking lifecycle and revenue surface."
            : "Your shipment bookings with dealer response and delivery progress."
      }
      actions={
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 min-w-44">
          <option value="">All statuses</option>
          {bookingStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Bookings" value={summary.total} hint="Matching current filter" icon={PackageCheck} />
        <StatCard title="Needs Attention" value={summary.pending} hint="Awaiting dealer response" icon={CalendarClock} />
        <StatCard title="Active Trips" value={summary.active} hint={activeBookingFlow.join(" -> ")} icon={Truck} />
        <StatCard title={user?.role === "DEALER" ? "Potential Value" : "Booked Value"} value={formatCurrency(summary.totalValue)} hint={`${formatNumber(summary.totalDistance)} km total`} icon={user?.role === "DEALER" ? IndianRupee : Route} />
      </div>

      <Card>
        <CardHeader
          title="Booking queue"
          subtitle="Click any row to review status history, parties, pricing, and valid next actions."
          actions={summary.delivered ? <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{summary.delivered} delivered</div> : null}
        />
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => navigate(`/bookings/${row.id}`)}
          empty={
            <EmptyState
              title="No bookings found"
              message={
                user?.role === "WAREHOUSE" || user?.role === "CARGO_DEALER"
                  ? "Create a shipment, choose an available truck, and the booking will appear here."
                  : user?.role === "DEALER"
                    ? "No warehouse has requested one of your trucks for this status yet."
                    : "No records matched the current filter."
              }
            />
          }
        />
      </Card>
    </Page>
  );
}
