import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { bookingService } from "../services/bookingService";
import { useAuthStore } from "../store/authStore";
import { activeBookingFlow, formatCurrency, formatDate } from "../lib/utils";
import { Button, Card, CardHeader, KeyValue, Page, StatusBadge, Timeline } from "../components/ui/primitives";

const transitionsByRole = {
  ADMIN: ["APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED"],
  DEALER: ["APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "REJECTED"],
  WAREHOUSE: ["CANCELLED"],
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const bookingQuery = useQuery({ queryKey: ["booking", id], queryFn: () => bookingService.getOne(id) });

  const mutation = useMutation({
    mutationFn: (status) => bookingService.updateStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", id] }),
  });

  const booking = bookingQuery.data;
  if (!booking) return null;

  return (
    <Page title="Booking detail" subtitle="Role-gated status transitions are enforced server-side.">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title={booking.id} subtitle={booking.notes || "No notes"} actions={<StatusBadge status={booking.status} />} />
          <KeyValue
            items={[
              { label: "Shipment", value: booking.shipment?.description || booking.shipmentId },
              { label: "Truck", value: booking.truck?.registrationNo || booking.truckId },
              { label: "Distance", value: booking.distanceKm ? `${booking.distanceKm} km` : "—" },
              { label: "Total", value: formatCurrency(booking.pricing?.total) },
              { label: "Created", value: formatDate(booking.createdAt) },
              { label: "ETA", value: formatDate(booking.estimatedEta) },
            ]}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            {(transitionsByRole[user?.role] || []).map((status) => (
              <Button key={status} variant={status === "CANCELLED" || status === "REJECTED" ? "danger" : "secondary"} onClick={() => mutation.mutate(status)} loading={mutation.isPending}>
                {status}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Lifecycle" subtitle="The canonical booking progression supported by the backend service." />
          <Timeline items={activeBookingFlow.map((status) => ({ label: status, active: activeBookingFlow.indexOf(status) <= activeBookingFlow.indexOf(booking.status) }))} />
        </Card>
      </div>
    </Page>
  );
}
