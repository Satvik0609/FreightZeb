import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { shipmentService } from "../services/shipmentService";
import { useAuthStore } from "../store/authStore";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { bookingStatuses, formatAgo, formatDate, formatNumber, shipmentStatuses, truckTypes } from "../lib/utils";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Input, Modal, Page, SearchInput, Select, StatusBadge, Textarea } from "../components/ui/primitives";

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
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
    queryFn: () =>
      user?.role === "ADMIN"
        ? shipmentService.listAll({ status: status || undefined })
        : shipmentService.listMine({ status: status || undefined, search: debouncedSearch || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: shipmentService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setModalOpen(false);
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
      subtitle="Warehouse-created consignments and optimization state."
      actions={
        <>
          <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description" />
          {user?.role !== "ADMIN" ? <Button icon={Plus} onClick={() => setModalOpen(true)}>New shipment</Button> : null}
        </>
      }
    >
      <Card>
        <CardHeader
          title="Shipment registry"
          subtitle="The booking lifecycle is derived from backend states only."
          actions={
            <div className="flex gap-2">
              <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 min-w-44">
                <option value="">All statuses</option>
                {shipmentStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </div>
          }
        />
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => navigate(`/shipments/${row.id}`)}
          empty={<EmptyState title="No shipments found" message="Adjust the filters or create a shipment to start booking against the live fleet." />}
        />
      </Card>

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
