import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Sparkles, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import { bookingService } from "../services/bookingService";
import { shipmentService } from "../services/shipmentService";
import { truckService } from "../services/truckService";
import { useAuthStore } from "../store/authStore";
import { Button, Card, CardHeader, EmptyState, KeyValue, Page, ProgressBar, StatusBadge } from "../components/ui/primitives";
import { formatCurrency, formatDate, formatNumber } from "../lib/utils";

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const shipmentQuery = useQuery({ queryKey: ["shipment", id], queryFn: () => shipmentService.getOne(id) });
  const availableQuery = useQuery({
    queryKey: ["available-trucks", id],
    queryFn: () => truckService.listAvailable({}),
    enabled: user?.role !== "ADMIN" || true,
  });

  const optimizeMutation = useMutation({
    mutationFn: () => shipmentService.optimize(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipment", id] }),
  });

  const bookingMutation = useMutation({
    mutationFn: bookingService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipment", id] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => shipmentService.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipment", id] }),
  });

  const shipment = shipmentQuery.data;
  if (!shipment) return <EmptyState title="Shipment not found" message="The backend did not return this shipment." />;

  return (
    <Page title="Shipment detail" subtitle="Optimization, prediction artifacts, and booking controls for a single shipment.">
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader
            title={shipment.description || "Shipment"}
            subtitle={`${shipment.pickupLocation?.address} → ${shipment.destination?.address}`}
            actions={<StatusBadge status={shipment.status} />}
          />
          <KeyValue
            items={[
              { label: "Weight", value: `${formatNumber(shipment.weightKg)} kg` },
              { label: "Volume", value: `${formatNumber(shipment.volumeM3)} m3` },
              { label: "Boxes", value: shipment.boxes || "—" },
              { label: "Deadline", value: formatDate(shipment.deadline) },
            ]}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            {user?.role !== "ADMIN" ? <Button icon={Sparkles} loading={optimizeMutation.isPending} onClick={() => optimizeMutation.mutate()}>Run optimization</Button> : null}
            {shipment.status !== "CANCELLED" && shipment.status !== "DELIVERED" ? (
              <Button variant="danger" icon={XCircle} loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                Cancel shipment
              </Button>
            ) : null}
          </div>

          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Prediction ledger</h3>
            {(shipment.predictions || []).map((prediction) => (
              <div key={prediction.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{prediction.type}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Model {prediction.modelVersion || "unknown"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{prediction.value}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Confidence {prediction.confidence ?? "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Available trucks" subtitle="Use live fleet data to create a booking." />
            <div className="space-y-4">
              {(availableQuery.data?.items || []).slice(0, 5).map((truck) => (
                <div key={truck.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{truck.registrationNo}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {truck.truckType} · {truck.routeFrom} → {truck.routeTo}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        bookingMutation.mutate({
                          shipmentId: shipment.id,
                          truckId: truck.id,
                          optimScore: 0.9,
                          notes: "Created from shipment detail surface",
                        })
                      }
                    >
                      Book
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <ProgressBar value={(shipment.weightKg / truck.capacityKg) * 100} label="Weight utilization" />
                    <ProgressBar value={((shipment.volumeM3 || 0) / (truck.capacityM3 || 1)) * 100} label="Volume utilization" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Bookings" subtitle="Recent booking objects attached to this shipment." />
            <div className="space-y-4">
              {(shipment.bookings || []).length ? shipment.bookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{booking.truck?.registrationNo || "Truck"}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(booking.pricing?.total)}</div>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                </div>
              )) : <EmptyState icon={Box} title="No bookings yet" message="Book against an available truck after optimization." />}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
