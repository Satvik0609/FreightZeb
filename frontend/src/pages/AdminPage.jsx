import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRightLeft, BrainCircuit, FileText, Receipt, RefreshCw, Trash2, Truck, Users } from "lucide-react";
import toast from "react-hot-toast";
import { adminService } from "../services/adminService";
import { analyticsService } from "../services/analyticsService";
import { invoiceService } from "../services/invoiceService";
import { truckService } from "../services/truckService";
import { mlService } from "../services/mlService";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatCurrency, formatDate, formatNumber, invoiceStatuses, percent, roles } from "../lib/utils";
import {
  Badge, Button, Card, CardHeader, DataTable, EmptyState, Page,
  ProgressBar, SearchInput, Select, StatCard, StatusBadge, VirtualList,
} from "../components/ui/primitives";

const ROLE_LABELS = {
  ADMIN: "Admin", WAREHOUSE: "Warehouse Manager",
  DEALER: "Truck Dealer", CARGO_DEALER: "Cargo Dealer",
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  // ── Data queries ──────────────────────────────────────────────────────────
  const summaryQuery = useQuery({ queryKey: ["admin-summary"], queryFn: analyticsService.adminSummary, staleTime: 30_000 });
  const usersQuery = useQuery({ queryKey: ["admin-users", roleFilter, debouncedSearch], queryFn: () => adminService.listUsers({ role: roleFilter || undefined, search: debouncedSearch || undefined, limit: 200 }) });
  const trucksQuery = useQuery({ queryKey: ["admin-trucks"], queryFn: () => truckService.listAll({ limit: 200 }), enabled: tab === "trucks" });
  const invoicesQuery = useQuery({ queryKey: ["admin-invoices", invoiceStatus], queryFn: () => invoiceService.listAll({ status: invoiceStatus || undefined, limit: 200 }), enabled: tab === "invoices" });

  const analytics = summaryQuery.data?.analytics || {};
  const recentBookings = summaryQuery.data?.recentBookings || [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: adminService.toggleUser,
    onSuccess: (_, id) => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User status updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteUser,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteTruckMutation = useMutation({
    mutationFn: (id) => truckService.listAll({}).then(() => fetch(`/api/trucks/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("freightzen-auth") ? JSON.parse(localStorage.getItem("freightzen-auth")).token : ""}` } })),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-trucks"] }); toast.success("Truck deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: invoiceService.markPaid,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }); toast.success("Invoice marked as paid"); },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: invoiceService.cancel,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }); toast.success("Invoice cancelled"); },
  });

  const retrainMutation = useMutation({
    mutationFn: () => import("../services/http").then(({ post }) => post("/ml/retrain", {})),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ml-models"] });
      const summary = Object.entries(data.results || {}).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v.status}`).join(" · ");
      toast.success(`Retrain complete — ${summary || "done"}`);
    },
    onError: (err) => toast.error(`Retrain failed: ${err.message}`),
  });

  // ── Status distribution ───────────────────────────────────────────────────
  const shipmentStatuses = analytics.shipments?.byStatus || {};
  const bookingStatuses = analytics.bookings?.byStatus || {};
  const truckStatuses = analytics.trucks?.byStatus || {};

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "trucks", label: "Trucks", icon: Truck },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "bookings", label: "Bookings", icon: FileText },
  ];

  return (
    <Page
      title="Admin Control Center"
      subtitle="Platform-wide management — users, fleet, invoices, ML models."
      actions={
        <Button icon={RefreshCw} variant="secondary" loading={retrainMutation.isPending} onClick={() => retrainMutation.mutate()}>
          Retrain ML Models
        </Button>
      }
    >
      {/* ── Stat cards ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Users" value={analytics.users?.total || 0} hint="Platform accounts" icon={Users} />
        <StatCard title="Total Shipments" value={analytics.shipments?.total || 0} hint="All warehouses" icon={ArrowRightLeft} />
        <StatCard title="Total Trucks" value={analytics.trucks?.total || 0} hint="Registered fleet" icon={Truck} />
        <StatCard title="Total Bookings" value={analytics.bookings?.total || 0} hint={`${formatNumber(analytics.totalDeliveredKm)} km delivered`} icon={Receipt} />
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${tab === t.id
                ? "bg-white shadow-sm dark:bg-slate-800 text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader title="Shipment status" subtitle="Platform-wide distribution" />
            <div className="space-y-3">
              {Object.entries(shipmentStatuses).length === 0 ? (
                <p className="text-sm text-slate-400">No data</p>
              ) : Object.entries(shipmentStatuses).map(([status, count]) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="font-medium">{count}</span>
                  </div>
                  <ProgressBar value={Math.min(100, (Number(count) / Math.max(...Object.values(shipmentStatuses), 1)) * 100)} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Booking status" subtitle="Lifecycle distribution" />
            <div className="space-y-3">
              {Object.entries(bookingStatuses).length === 0 ? (
                <p className="text-sm text-slate-400">No data</p>
              ) : Object.entries(bookingStatuses).map(([status, count]) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="font-medium">{count}</span>
                  </div>
                  <ProgressBar value={Math.min(100, (Number(count) / Math.max(...Object.values(bookingStatuses), 1)) * 100)} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Fleet status" subtitle="Truck availability" />
            <div className="space-y-3">
              {Object.entries(truckStatuses).length === 0 ? (
                <p className="text-sm text-slate-400">No data</p>
              ) : Object.entries(truckStatuses).map(([status, count]) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="font-medium">{count}</span>
                  </div>
                  <ProgressBar value={Math.min(100, (Number(count) / Math.max(...Object.values(truckStatuses), 1)) * 100)} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader title="Recent bookings" subtitle="Last 10 platform-wide" />
            <div className="space-y-3">
              {recentBookings.length === 0 ? (
                <EmptyState title="No bookings yet" message="Bookings will appear here once created." />
              ) : recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{b.shipment?.description?.slice(0, 40) || b.id.slice(0, 8)}</div>
                    <div className="text-xs text-slate-500">{b.warehouse?.company || b.warehouse?.name} → {b.dealer?.company || b.dealer?.name}</div>
                    <div className="text-xs text-slate-400">{b.truck?.registrationNo} · {b.truck?.truckType}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatCurrency(b.pricing?.total)}</div>
                      <div className="text-xs text-slate-400">{formatDate(b.createdAt)}</div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Users tab ── */}
      {tab === "users" && (
        <Card>
          <CardHeader
            title="User management"
            subtitle={`${usersQuery.data?.total || 0} accounts`}
            actions={
              <div className="flex gap-2">
                <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company" />
                <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-11 min-w-44">
                  <option value="">All roles</option>
                  {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                </Select>
              </div>
            }
          />
          <VirtualList
            items={usersQuery.data?.items || []}
            height={580}
            rowHeight={110}
            empty={<EmptyState title="No users found" message="Adjust filters." />}
            renderItem={(user) => (
              <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{user.name}</div>
                      {!user.isActive && <Badge variant="danger">Inactive</Badge>}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                    <div className="text-xs text-slate-400">{user.company || "No company"} · Joined {formatDate(user.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={user.role}
                      onChange={(e) => adminService.updateRole(user.id, e.target.value).then(() => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role updated"); })}
                      className="h-9 min-w-36 text-sm"
                    >
                      {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                    </Select>
                    <Button variant="secondary" className="h-9 text-sm" onClick={() => toggleMutation.mutate(user.id)}>
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="danger"
                      className="h-9 text-sm"
                      icon={Trash2}
                      onClick={() => { if (confirm(`Delete ${user.name}?`)) deleteMutation.mutate(user.id); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {/* ── Trucks tab ── */}
      {tab === "trucks" && (
        <Card>
          <CardHeader title="Fleet management" subtitle={`${trucksQuery.data?.total || 0} trucks registered`} />
          <DataTable
            columns={[
              { key: "registrationNo", label: "Registration" },
              { key: "truckType", label: "Type" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "capacityKg", label: "Capacity", render: (row) => `${formatNumber(row.capacityKg)} kg` },
              { key: "route", label: "Route", render: (row) => `${row.routeFrom} → ${row.routeTo}` },
              { key: "dealer", label: "Dealer", render: (row) => row.dealer?.company || row.dealer?.name || "—" },
              { key: "pricePerKm", label: "₹/km", render: (row) => row.pricePerKm ? `₹${row.pricePerKm}` : "—" },
              {
                key: "actions", label: "",
                render: (row) => (
                  <Button
                    variant="danger"
                    icon={Trash2}
                    className="h-8 text-xs"
                    onClick={() => {
                      if (confirm(`Delete truck ${row.registrationNo}?`)) {
                        const token = JSON.parse(localStorage.getItem("freightzen-auth") || "{}").token;
                        fetch(`/api/trucks/${row.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
                          .then(() => { queryClient.invalidateQueries({ queryKey: ["admin-trucks"] }); toast.success("Truck deleted"); })
                          .catch(() => toast.error("Cannot delete — truck has active bookings"));
                      }
                    }}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
            rows={trucksQuery.data?.items || []}
            empty={<EmptyState icon={Truck} title="No trucks" message="No trucks registered yet." />}
          />
        </Card>
      )}

      {/* ── Invoices tab ── */}
      {tab === "invoices" && (
        <Card>
          <CardHeader
            title="Invoice management"
            subtitle={`${invoicesQuery.data?.total || 0} invoices`}
            actions={
              <Select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="h-11 min-w-44">
                <option value="">All statuses</option>
                {invoiceStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            }
          />
          <DataTable
            columns={[
              { key: "invoiceNo", label: "Invoice No" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "company", label: "Billed To", render: (row) => row.user?.company || row.user?.name || "—" },
              { key: "shipment", label: "Shipment", render: (row) => row.booking?.shipment?.description?.slice(0, 30) || "—" },
              { key: "total", label: "Total", render: (row) => formatCurrency(row.pricing?.total) },
              { key: "issuedAt", label: "Issued", render: (row) => formatDate(row.issuedAt) },
              { key: "dueDate", label: "Due", render: (row) => formatDate(row.dueDate) },
              {
                key: "actions", label: "",
                render: (row) => (
                  <div className="flex gap-2">
                    {row.status !== "PAID" && row.status !== "CANCELLED" && (
                      <Button variant="secondary" className="h-8 text-xs" onClick={() => markPaidMutation.mutate(row.id)}>
                        Mark Paid
                      </Button>
                    )}
                    {row.status !== "PAID" && row.status !== "CANCELLED" && (
                      <Button variant="danger" className="h-8 text-xs" onClick={() => cancelInvoiceMutation.mutate(row.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={invoicesQuery.data?.items || []}
            empty={<EmptyState icon={Receipt} title="No invoices" message="Invoices are generated on delivery." />}
          />
        </Card>
      )}

      {/* ── Bookings tab ── */}
      {tab === "bookings" && (
        <Card>
          <CardHeader title="All bookings" subtitle="Platform-wide booking ledger" />
          <DataTable
            columns={[
              { key: "id", label: "ID", render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span> },
              { key: "shipment", label: "Shipment", render: (row) => row.shipment?.description?.slice(0, 28) || "—" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "warehouse", label: "Warehouse", render: (row) => row.warehouse?.company || row.warehouse?.name || "—" },
              { key: "dealer", label: "Dealer", render: (row) => row.dealer?.company || row.dealer?.name || "—" },
              { key: "truck", label: "Truck", render: (row) => row.truck?.registrationNo || "—" },
              { key: "total", label: "Total", render: (row) => formatCurrency(row.pricing?.total) },
              { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            ]}
            rows={recentBookings}
            empty={<EmptyState icon={FileText} title="No bookings" message="No bookings yet." />}
          />
        </Card>
      )}
    </Page>
  );
}
