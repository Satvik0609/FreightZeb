import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { bookingService } from "../services/bookingService";
import { useAuthStore } from "../store/authStore";
import { activeBookingFlow, formatCurrency, formatDate } from "../lib/utils";
import { Card, CardHeader, DataTable, EmptyState, Page, Select, StatusBadge } from "../components/ui/primitives";

export default function BookingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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

  const columns = useMemo(
    () => [
      { key: "id", label: "Booking", render: (row) => <div className="font-medium">{row.id.slice(0, 8)}</div> },
      { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
      { key: "warehouse", label: "Warehouse", render: (row) => row.warehouse?.company || row.warehouse?.name || "—" },
      { key: "dealer", label: "Dealer", render: (row) => row.dealer?.company || row.dealer?.name || "—" },
      { key: "pricing", label: "Total", render: (row) => formatCurrency(row.pricing?.total) },
      { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
    ],
    [],
  );

  return (
    <Page
      title="Bookings"
      subtitle="The client reflects the exact backend transition graph and role gates."
      actions={
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 min-w-44">
          <option value="">All statuses</option>
          {["REQUESTED", "APPROVED", "REJECTED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      }
    >
      <Card>
        <CardHeader title="Booking ledger" subtitle={`Primary lifecycle: ${activeBookingFlow.join(" → ")}`} />
        <DataTable
          columns={columns}
          rows={bookingsQuery.data?.items || []}
          onRowClick={(row) => navigate(`/bookings/${row.id}`)}
          empty={<EmptyState title="No bookings found" message="No records matched the current role and filter set." />}
        />
      </Card>
    </Page>
  );
}
