import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Weight, Box, Calendar, Building2, ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { shipmentService } from "../services/shipmentService";
import { bookingService } from "../services/bookingService";
import { truckService } from "../services/truckService";
import { useAuthStore } from "../store/authStore";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatAgo, formatNumber, formatDate, shipmentStatuses, cn } from "../lib/utils";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Input, Modal, Page, SearchInput, Select, StatusBadge, Textarea } from "../components/ui/primitives";
import { getSocket } from "../lib/socket";

// ── Dealer shipment card ──────────────────────────────────────────────────────
function ShipmentCard({ shipment, onAccept, accepting }) {
  const pickup = shipment.pickupLocation;
  const dest = shipment.destination;
  const urgent = shipment.deadline && new Date(shipment.deadline) < new Date(Date.now() + 48 * 3600 * 1000);

  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700">
      {urgent && (
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <Zap className="h-3 w-3" /> Urgent
        </span>
      )}

      {/* Route */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
          <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span className="truncate">{pickup?.city || pickup?.address || "Pickup"}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{dest?.city || dest?.address || "Destination"}</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
            {shipment.description || "No description"}
          </div>
        </div>
      </div>

      {/* Chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Weight className="h-3 w-3" />{formatNumber(shipment.weightKg)} kg
        </span>
        {shipment.volumeM3 && (
          <span className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Box className="h-3 w-3" />{formatNumber(shipment.volumeM3)} m³
          </span>
        )}
        {shipment.deadline && (
          <span className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium",
            urgent
              ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          )}>
            <Calendar className="h-3 w-3" />{formatDate(shipment.deadline, "dd MMM")}
          </span>
        )}
        <StatusBadge status={shipment.status} />
      </div>

      {/* Warehouse + action */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            {shipment.warehouse?.company || shipment.warehouse?.name || "Warehouse"}
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
          <span className="text-xs text-slate-400">{formatAgo(shipment.createdAt)}</span>
        </div>
        <Button
          size="sm"
          loading={accepting}
          onClick={(e) => { e.stopPropagation(); onAccept(shipment); }}
          className="shrink-0 h-9 px-4 text-xs"
        >
          Accept
        </Button>
      </div>
    </div>
  );
}

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [acceptModal, setAcceptModal] = useState(null); // shipment being accepted
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  // dealer/cargo_dealer truck list for accept modal
  const trucksQuery = useQuery({
    queryKey: ["my-trucks-for-accept"],
    queryFn: () => truckService.listMine({}),
    enabled: user?.role === "DEALER" || user?.role === "CARGO_DEALER",
  });

  const acceptMutation = useMutation({
    mutationFn: ({ shipmentId, truckId }) => bookingService.dealerAccept({ shipmentId, truckId }),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking created — you can now manage it in Bookings.");
      setAcceptModal(null);
      setSelectedTruckId("");
      navigate(`/bookings/${booking.id}`);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to accept shipment"),
  });

  // ── Real-time: invalidate list when a new shipment is created ──────────────
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const handler = () => queryClient.invalidateQueries({ queryKey: ["shipments"] });
    socket.on("shipment:created", handler);
    return () => socket.off("shipment:created", handler);
  }, [token, queryClient]);
  const [form, setForm] = useState({
    weightKg: "",
    volumeM3: "",
    boxes: "",
    pickupLocation: { lat: "", lng: "", address: "", city: "", pincode: "" },
    destination: { lat: "", lng: "", address: "", city: "", pincode: "" },
    deadline: "",
    description: "",
    requirements: {
      hazardous: false,
      fragile: false,
      tempControlled: false,
      oversized: false,
    },
  });

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", user?.role, status, debouncedSearch],
    queryFn: () => {
      if (user?.role === "ADMIN") return shipmentService.listAll({ status: status || undefined });
      if (user?.role === "DEALER") return shipmentService.listAvailable({ status: status || undefined, search: debouncedSearch || undefined });
      // WAREHOUSE and CARGO_DEALER see their own shipments
      return shipmentService.listMine({ status: status || undefined, search: debouncedSearch || undefined });
    },
  });

  const createMutation = useMutation({
    mutationFn: shipmentService.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      toast.success("Shipment created — ML predictions running...");
      setModalOpen(false);
      setForm({
        weightKg: "", volumeM3: "", boxes: "",
        pickupLocation: { lat: "", lng: "", address: "", city: "", pincode: "" },
        destination: { lat: "", lng: "", address: "", city: "", pincode: "" },
        deadline: "", description: "",
        requirements: { hazardous: false, fragile: false, tempControlled: false, oversized: false },
      });
    },
  });

  const rows = shipmentsQuery.data?.items || [];
  const columns = useMemo(
    () => [
      {
        key: "description",
        label: "Shipment",
        render: (row) => (
          <div className="space-y-1">
            <div className="font-medium">{row.description || "Untitled shipment"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {row.pickupLocation?.city || row.pickupLocation?.address} → {row.destination?.city || row.destination?.address}
            </div>
          </div>
        ),
      },
      { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
      { key: "weightKg", label: "Weight", render: (row) => `${formatNumber(row.weightKg)} kg` },
      { key: "volumeM3", label: "Volume", render: (row) => `${formatNumber(row.volumeM3)} m3` },
      { key: "updatedAt", label: "Updated", render: (row) => formatAgo(row.updatedAt) },
      {
        key: "bookings",
        label: "Latest Booking",
        render: (row) => row.bookings?.[0] ? <Badge>{row.bookings[0].truck?.truckType || "Assigned"}</Badge> : <span className="text-slate-400">None</span>,
      },
    ],
    [],
  );

  return (
    <Page
      title="Shipments"
      subtitle={
        user?.role === "DEALER"
          ? "All available shipments — click one to view details and book a truck."
          : "Your consignments and their optimization state."
      }
      actions={
        <>
          <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description" />
          {(user?.role === "WAREHOUSE" || user?.role === "CARGO_DEALER") ? <Button icon={Plus} onClick={() => setModalOpen(true)}>New shipment</Button> : null}
        </>
      }
    >
      <Card>
        <CardHeader
          title={user?.role === "DEALER" ? "Available shipments" : "Shipment registry"}
          subtitle={user?.role === "DEALER" ? "PENDING and OPTIMIZED shipments from all warehouses — accept any to create a booking." : "The booking lifecycle is derived from backend states only."}
          actions={
            <div className="flex gap-2">
              <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 min-w-44">
                <option value="">All statuses</option>
                {shipmentStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </div>
          }
        />
        {user?.role === "DEALER" ? (
          rows.length === 0 ? (
            <EmptyState title="No shipments found" message="No bookable shipments right now. Check back when warehouses create new consignments." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((shipment) => (
                <ShipmentCard
                  key={shipment.id}
                  shipment={shipment}
                  accepting={acceptMutation.isPending && acceptMutation.variables?.shipmentId === shipment.id}
                  onAccept={(s) => { setAcceptModal(s); setSelectedTruckId(""); }}
                />
              ))}
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(row) => navigate(`/shipments/${row.id}`)}
            empty={<EmptyState title="No shipments found" message="Create a shipment to start booking against the live fleet." />}
          />
        )}
      </Card>

      {/* Accept shipment modal — truck selector */}
      <Modal
        open={Boolean(acceptModal)}
        title="Accept shipment"
        subtitle={acceptModal ? `${acceptModal.pickupLocation?.city || "Pickup"} → ${acceptModal.destination?.city || "Destination"} · ${formatNumber(acceptModal.weightKg)} kg` : ""}
        onClose={() => { setAcceptModal(null); setSelectedTruckId(""); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAcceptModal(null); setSelectedTruckId(""); }}>Cancel</Button>
            <Button
              loading={acceptMutation.isPending}
              disabled={!selectedTruckId}
              onClick={() => acceptMutation.mutate({ shipmentId: acceptModal.id, truckId: selectedTruckId })}
            >
              Confirm &amp; Accept
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose one of your available trucks to assign to this shipment. A booking will be created and you can manage it from the Bookings page.
        </p>
        <Select
          label="Select your truck"
          value={selectedTruckId}
          onChange={(e) => setSelectedTruckId(e.target.value)}
        >
          <option value="">— choose a truck —</option>
          {(trucksQuery.data?.items || [])
            .filter((t) => t.status === "AVAILABLE")
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.registrationNo} · {t.truckType} · {formatNumber(t.capacityKg)} kg cap
              </option>
            ))}
        </Select>
        {(trucksQuery.data?.items || []).filter((t) => t.status === "AVAILABLE").length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">No available trucks right now. Mark a truck as available first.</p>
        )}
      </Modal>

      <Modal
        open={modalOpen}
        title="Create shipment"
        subtitle="Fields must match backend validation."
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  weightKg: Number(form.weightKg),
                  volumeM3: form.volumeM3 ? Number(form.volumeM3) : undefined,
                  boxes: form.boxes ? Number(form.boxes) : undefined,
                  deadline: form.deadline || undefined,
                  pickupLocation: {
                    ...form.pickupLocation,
                    lat: Number(form.pickupLocation.lat),
                    lng: Number(form.pickupLocation.lng),
                  },
                  destination: {
                    ...form.destination,
                    lat: Number(form.destination.lat),
                    lng: Number(form.destination.lng),
                  },
                })
              }
            >
              Create shipment
            </Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Weight Kg" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} />
          <Input label="Volume M3" value={form.volumeM3} onChange={(event) => setForm({ ...form, volumeM3: event.target.value })} />
          <Input label="Boxes" value={form.boxes} onChange={(event) => setForm({ ...form, boxes: event.target.value })} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Pickup address" value={form.pickupLocation.address} onChange={(event) => setForm({ ...form, pickupLocation: { ...form.pickupLocation, address: event.target.value } })} />
          <Input label="Destination address" value={form.destination.address} onChange={(event) => setForm({ ...form, destination: { ...form.destination, address: event.target.value } })} />
          <Input label="Pickup latitude" value={form.pickupLocation.lat} onChange={(event) => setForm({ ...form, pickupLocation: { ...form.pickupLocation, lat: event.target.value } })} />
          <Input label="Pickup longitude" value={form.pickupLocation.lng} onChange={(event) => setForm({ ...form, pickupLocation: { ...form.pickupLocation, lng: event.target.value } })} />
          <Input label="Destination latitude" value={form.destination.lat} onChange={(event) => setForm({ ...form, destination: { ...form.destination, lat: event.target.value } })} />
          <Input label="Destination longitude" value={form.destination.lng} onChange={(event) => setForm({ ...form, destination: { ...form.destination, lng: event.target.value } })} />
        </div>
        <Input label="Deadline" type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
        <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="grid gap-3 md:grid-cols-2">
          {Object.keys(form.requirements).map((key) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <input type="checkbox" checked={form.requirements[key]} onChange={(event) => setForm({ ...form, requirements: { ...form.requirements, [key]: event.target.checked } })} />
              <span className="text-sm">{key}</span>
            </label>
          ))}
        </div>
      </Modal>
    </Page>
  );
}
