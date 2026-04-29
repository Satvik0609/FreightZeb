import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MapPinned, Plus, Target } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { truckService } from "../services/truckService";
import { bookingService } from "../services/bookingService";
import { formatCurrency, formatNumber, truckTypes } from "../lib/utils";
import { Button, Card, CardHeader, DataTable, EmptyState, Input, Modal, Page, Select, StatusBadge } from "../components/ui/primitives";
import toast from "react-hot-toast";

export default function TrucksPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [form, setForm] = useState({
    registrationNo: "",
    truckType: "CONTAINER_20FT",
    capacityKg: "",
    capacityM3: "",
    routeFrom: "",
    routeTo: "",
    pricePerKm: "",
  });

  const isFleetRole = user?.role === "DEALER" || user?.role === "CARGO_DEALER";

  const trucksQuery = useQuery({
    queryKey: ["trucks", user?.role, status],
    queryFn: () =>
      user?.role === "ADMIN"
        ? truckService.listAll({ status: status || undefined })
        : isFleetRole
          ? truckService.listMine({ status: status || undefined })
          : truckService.listAvailable({}),
  });

  const matchesQuery = useQuery({
    queryKey: ["truck-shipment-matches", selectedTruck?.id],
    queryFn: () => truckService.shipmentMatches(selectedTruck.id, { limit: 8 }),
    enabled: isFleetRole && Boolean(selectedTruck?.id),
  });

  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: truckService.create,
    onSuccess: () => {
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: ({ shipmentId, truckId }) =>
      bookingService.dealerAccept({ shipmentId, truckId }),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["truck-shipment-matches"] });
      toast.success("Booking accepted");
      navigate(`/bookings/${booking.id}`);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to accept"),
  });

  const columns = useMemo(
    () => [
      { key: "registrationNo", label: "Registration" },
      { key: "truckType", label: "Type" },
      { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
      { key: "capacityKg", label: "Capacity", render: (row) => `${formatNumber(row.capacityKg)} kg` },
      { key: "route", label: "Route", render: (row) => `${row.routeFrom} -> ${row.routeTo}` },
      { key: "pricePerKm", label: "Price/km", render: (row) => row.pricePerKm ? `${formatCurrency(row.pricePerKm)}/km` : "-" },
      ...(isFleetRole ? [] : [{ key: "dealer", label: "Dealer", render: (row) => row.dealer?.company || row.dealer?.name || "-" }]),
    ],
    [user?.role],
  );

  const matchColumns = useMemo(
    () => [
      { key: "shipment", label: "Shipment", render: (row) => row.shipment.description || row.shipment.id.slice(0, 8) },
      { key: "lane", label: "Lane", render: (row) => `${row.shipment.pickupLocation?.city || "Pickup"} -> ${row.shipment.destination?.city || "Destination"}` },
      { key: "score", label: "Fit", render: (row) => `${row.score}%` },
      { key: "distanceKm", label: "Distance", render: (row) => row.distanceKm ? `${formatNumber(row.distanceKm)} km` : "-" },
      { key: "estimatedRevenue", label: "Revenue", render: (row) => formatCurrency(row.estimatedRevenue) },
      { key: "estimatedProfit", label: "Profit", render: (row) => formatCurrency(row.estimatedProfit) },
      { key: "marginPct", label: "Margin", render: (row) => row.marginPct == null ? "-" : `${row.marginPct}%` },
      {
        key: "actions",
        label: "Action",
        render: (row) => (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              disabled={selectedTruck?.status !== "AVAILABLE"}
              loading={acceptMutation.isPending && acceptMutation.variables?.shipmentId === row.shipment.id}
              onClick={() => acceptMutation.mutate({ shipmentId: row.shipment.id, truckId: selectedTruck.id })}
            >
              Accept
            </Button>
          </div>
        ),
      },
    ],
    [acceptMutation, selectedTruck],
  );

  return (
    <Page
      title="Trucks"
      subtitle={
        isFleetRole
          ? "Manage your fleet and find profitable shipment matches."
          : user?.role === "ADMIN"
            ? "Full fleet registry across all dealers."
            : "Available trucks for shipment planning and booking."
      }
      actions={
        <>
          {isFleetRole || user?.role === "ADMIN" ? (
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 min-w-44">
              <option value="">All statuses</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="BOOKED">BOOKED</option>
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </Select>
          ) : null}
          {isFleetRole ? <Button icon={Plus} onClick={() => setModalOpen(true)}>Add truck</Button> : null}
        </>
      }
    >
      <Card>
        <CardHeader
          title={isFleetRole ? "My fleet" : "Fleet registry"}
          subtitle={isFleetRole ? "Click a truck to calculate shipment fit and estimated profit." : "Truck records and backend availability flags."}
        />
        <DataTable
          columns={columns}
          rows={trucksQuery.data?.items || []}
          onRowClick={isFleetRole ? setSelectedTruck : undefined}
          empty={<EmptyState icon={MapPinned} title="No trucks found" message="Adjust filters or add a truck if you are a dealer." />}
        />
      </Card>

      {isFleetRole ? (
        <Card>
          <CardHeader
            title="Best shipment matches"
            subtitle={selectedTruck ? `Ranked open shipments for ${selectedTruck.registrationNo}.` : "Select one of your trucks to see suitable shipments and estimated profit."}
          />
          {selectedTruck && selectedTruck.status !== "AVAILABLE" ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
              This truck is currently <strong>{selectedTruck.status}</strong> — it must be AVAILABLE to accept new shipments.
            </div>
          ) : selectedTruck ? (
            <DataTable
              columns={matchColumns}
              rows={matchesQuery.data?.matches || []}
              empty={<EmptyState icon={Target} title="No matching shipments" message="No open shipment currently fits this truck's capacity and lane." />}
            />
          ) : (
            <EmptyState icon={Target} title="Select a truck" message="Click a truck from your fleet to calculate shipment fit, revenue, and estimated profit." />
          )}
        </Card>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add truck"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  capacityKg: Number(form.capacityKg),
                  capacityM3: form.capacityM3 ? Number(form.capacityM3) : undefined,
                  pricePerKm: form.pricePerKm ? Number(form.pricePerKm) : undefined,
                })
              }
            >
              Save truck
            </Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Registration number" value={form.registrationNo} onChange={(event) => setForm({ ...form, registrationNo: event.target.value })} />
          <Select label="Truck type" value={form.truckType} onChange={(event) => setForm({ ...form, truckType: event.target.value })}>
            {truckTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Input label="Capacity kg" value={form.capacityKg} onChange={(event) => setForm({ ...form, capacityKg: event.target.value })} />
          <Input label="Capacity m3" value={form.capacityM3} onChange={(event) => setForm({ ...form, capacityM3: event.target.value })} />
          <Input label="Route from" value={form.routeFrom} onChange={(event) => setForm({ ...form, routeFrom: event.target.value })} />
          <Input label="Route to" value={form.routeTo} onChange={(event) => setForm({ ...form, routeTo: event.target.value })} />
          <Input label="Price per km" value={form.pricePerKm} onChange={(event) => setForm({ ...form, pricePerKm: event.target.value })} />
        </div>
      </Modal>
    </Page>
  );
}
