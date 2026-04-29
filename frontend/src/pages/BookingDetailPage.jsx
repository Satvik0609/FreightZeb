import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, IndianRupee, Map, Route, Truck } from "lucide-react";
import { bookingService } from "../services/bookingService";
import { useAuthStore } from "../store/authStore";
import { activeBookingFlow, formatCurrency, formatDate, formatNumber } from "../lib/utils";
import { Button, Card, CardHeader, KeyValue, Page, StatCard, StatusBadge, Textarea, Timeline } from "../components/ui/primitives";
import LocationPusher from "../components/LocationPusher";
import LiveTrackingMap from "../components/LiveTrackingMap";

const transitions = {
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED"],
};

const roleTargets = {
  ADMIN: ["APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED"],
  DEALER: ["APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "REJECTED"],
  WAREHOUSE: ["CANCELLED"],
  // CARGO_DEALER can act as warehouse (cancel) OR as dealer (if they own the truck on this booking)
  CARGO_DEALER: ["APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "REJECTED", "CANCELLED"],
};

function nextActionsFor(role, status, booking, userId) {
  const byState = transitions[status] || [];
  const byRole = roleTargets[role] || [];
  let allowed = byState.filter((item) => byRole.includes(item));

  // CARGO_DEALER: restrict based on which side of the booking they're on
  if (role === "CARGO_DEALER" && booking) {
    const isDealer = booking.dealerId === userId;
    const isWarehouse = booking.warehouseId === userId;
    if (isDealer && !isWarehouse) {
      // acting as dealer — can't cancel (warehouse action)
      allowed = allowed.filter((s) => s !== "CANCELLED");
    } else if (isWarehouse && !isDealer) {
      // acting as warehouse — can only cancel
      allowed = allowed.filter((s) => s === "CANCELLED");
    }
    // if both (self-booking) — all actions available
  }
  return allowed;
}

function actionLabel(status) {
  const labels = {
    APPROVED: "Approve",
    REJECTED: "Reject",
    ASSIGNED: "Assign",
    PICKED_UP: "Picked up",
    IN_TRANSIT: "Start transit",
    DELIVERED: "Deliver",
    CANCELLED: "Cancel",
  };
  return labels[status] || status;
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [notes, setNotes] = useState("");
  const bookingQuery = useQuery({ queryKey: ["booking", id], queryFn: () => bookingService.getOne(id) });

  const mutation = useMutation({
    mutationFn: (status) => bookingService.updateStatus(id, { status, notes: notes || undefined }),
    onSuccess: () => {
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  const booking = bookingQuery.data;
  const actions = useMemo(() => nextActionsFor(user?.role, booking?.status, booking, user?.id), [user?.role, user?.id, booking]);

  // Check if user is dealer and booking is active for location tracking
  const canPushLocation = booking &&
    (user?.role === 'DEALER' || user?.role === 'CARGO_DEALER') &&
    booking.dealerId === user?.id &&
    ['PICKED_UP', 'IN_TRANSIT'].includes(booking.status);

  // Show live map for all roles once booking is active or delivered
  const canViewMap = booking && ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(booking.status);
  const isActiveBooking = booking && ['PICKED_UP', 'IN_TRANSIT'].includes(booking.status);

  if (!booking) return null;

  const currentStep = activeBookingFlow.indexOf(booking.status);
  const routeLabel = `${booking.shipment?.pickupLocation?.city || "Pickup"} -> ${booking.shipment?.destination?.city || "Destination"}`;
  const partyItems = [
    { label: "Warehouse", value: booking.warehouse?.company || booking.warehouse?.name || "-" },
    { label: "Dealer", value: booking.dealer?.company || booking.dealer?.name || "-" },
    { label: "Truck", value: `${booking.truck?.registrationNo || booking.truckId} (${booking.truck?.truckType || "Truck"})` },
    { label: "Shipment", value: booking.shipment?.description || booking.shipmentId },
  ];

  return (
    <Page
      title="Booking detail"
      subtitle={`Booking ${booking.id.slice(0, 8)} on ${routeLabel}`}
      actions={<Button variant="secondary" icon={ArrowLeft} onClick={() => navigate("/bookings")}>Back</Button>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Status" value={<StatusBadge status={booking.status} />} hint="Current lifecycle state" icon={Clock} />
        <StatCard title="Distance" value={booking.distanceKm ? `${formatNumber(booking.distanceKm)} km` : "-"} hint={routeLabel} icon={Route} />
        <StatCard title="Trip Value" value={formatCurrency(booking.pricing?.total)} hint={booking.invoice ? `Invoice ${booking.invoice.status}` : "Invoice after delivery"} icon={IndianRupee} />
        <StatCard title="ETA" value={formatDate(booking.estimatedEta, "dd MMM, HH:mm")} hint={booking.deliveredAt ? `Delivered ${formatDate(booking.deliveredAt, "dd MMM")}` : "Estimated arrival"} icon={Truck} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Parties and shipment" subtitle={booking.notes || "No notes on this booking."} />
          <KeyValue items={partyItems} />

          <div className="mt-6 space-y-4">
            <Textarea
              label="Status note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note for the next status update"
            />
            <div className="flex flex-wrap gap-3">
              {actions.length ? actions.map((status) => (
                <Button
                  key={status}
                  variant={status === "CANCELLED" || status === "REJECTED" ? "danger" : "secondary"}
                  onClick={() => mutation.mutate(status)}
                  loading={mutation.isPending}
                >
                  {actionLabel(status)}
                </Button>
              )) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <CheckCircle2 className="h-4 w-4" />
                  No valid action for your role at this state
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Lifecycle" subtitle="Only valid next transitions are shown as actions." />
            <Timeline
              items={activeBookingFlow.map((status, index) => ({
                label: status,
                caption: index === currentStep ? "Current state" : index < currentStep ? "Completed" : "Pending",
                active: currentStep >= 0 && index <= currentStep,
              }))}
            />
          </Card>

          {canPushLocation && (
            <LocationPusher
              bookingId={booking.id}
              onLocationPushed={() => queryClient.invalidateQueries({ queryKey: ["booking", id] })}
            />
          )}

          {canViewMap && (
            <Card>
              <CardHeader
                title="Live Location"
                subtitle={
                  isActiveBooking
                    ? user?.role === 'WAREHOUSE' || user?.role === 'ADMIN'
                      ? "Real-time truck position — updates automatically"
                      : "Your truck's live trail on the map"
                    : "Journey route for this booking"
                }
                icon={Map}
              />
              <LiveTrackingMap bookingId={booking.id} isActive={isActiveBooking} />
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
