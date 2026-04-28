import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned, Plus } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { truckService } from "../services/truckService";
import { formatNumber, truckTypes } from "../lib/utils";
import { Button, Card, CardHeader, DataTable, EmptyState, Input, Modal, Page, SearchInput, Select, StatusBadge } from "../components/ui/primitives";

export default function TrucksPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    registrationNo: "",
    truckType: "CONTAINER_20FT",
    capacityKg: "",
    capacityM3: "",
    routeFrom: "",
    routeTo: "",
    pricePerKm: "",
  });

  const trucksQuery = useQuery({
    queryKey: ["trucks", user?.role, status],
    queryFn: () =>
      user?.role === "ADMIN" ? truckService.listAll({ status: status || undefined }) : user?.role === "DEALER" ? truckService.listMine({ status: status || undefined }) : truckService.listAvailable({}),
  });

  const createMutation = useMutation({
    mutationFn: truckService.create,
    onSuccess: () => {
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
    },
  });

  const columns = useMemo(
    () => [
      { key: "registrationNo", label: "Registration" },
      { key: "truckType", label: "Type" },
      { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
      { key: "capacityKg", label: "Capacity", render: (row) => `${formatNumber(row.capacityKg)} kg` },
      { key: "route", label: "Route", render: (row) => `${row.routeFrom} → ${row.routeTo}` },
      { key: "pricePerKm", label: "Price/km", render: (row) => row.pricePerKm ?? "—" },
    ],
    [],
  );

  return (
    <Page
      title="Trucks"
      subtitle={user?.role === "DEALER" ? "Manage your fleet and update live location data." : "Authenticated users can inspect the available fleet surface."}
      actions={
        <>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 min-w-44">
            <option value="">All statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="BOOKED">BOOKED</option>
            <option value="IN_TRANSIT">IN_TRANSIT</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
          </Select>
          {user?.role === "DEALER" ? <Button icon={Plus} onClick={() => setModalOpen(true)}>Add truck</Button> : null}
        </>
      }
    >
      <Card>
        <CardHeader title="Fleet registry" subtitle="Truck records and backend availability flags." />
        <DataTable
          columns={columns}
          rows={trucksQuery.data?.items || []}
          empty={<EmptyState icon={MapPinned} title="No trucks found" message="Adjust filters or add a truck if you are a dealer." />}
        />
      </Card>

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
