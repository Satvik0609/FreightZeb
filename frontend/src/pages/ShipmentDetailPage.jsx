import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, BrainCircuit, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bookingService } from "../services/bookingService";
import { shipmentService } from "../services/shipmentService";
import { truckService } from "../services/truckService";
import { useAuthStore } from "../store/authStore";
import { Button, Card, CardHeader, EmptyState, KeyValue, Page, ProgressBar, StatusBadge } from "../components/ui/primitives";
import { formatCurrency, formatDate, formatNumber, haversineKm, percent } from "../lib/utils";
import { getSocket } from "../lib/socket";

const PREDICTION_LABELS = {
  ETA_HOURS: { label: "ETA", format: (v) => `${formatNumber(v)} hrs` },
  FUEL_ESTIMATE_LITERS: { label: "Fuel estimate", format: (v) => `${formatNumber(v)} L` },
  CO2_KG: { label: "CO₂ estimate", format: (v) => `${formatNumber(v)} kg` },
  RECOMMENDED_TRUCK_SCORE: { label: "Truck score", format: (v) => percent(v * 100) },
  DELAY_RISK_PERCENT: { label: "Delay risk", format: (v) => percent(v) },
};

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [optimResults, setOptimResults] = useState(null); // ranked trucks from optimization

  const shipmentQuery = useQuery({
    queryKey: ["shipment", id],
    queryFn: () => shipmentService.getOne(id),
  });

  const availableQuery = useQuery({
    queryKey: ["available-trucks", id],
    queryFn: () => truckService.listAvailable({ limit: 20 }),
  });

  // ── Real-time socket ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !id) return;
    const socket = getSocket(token);

    socket.on("shipment:created", (p) => { if (p?.shipmentId === id) setPredictionsLoading(true); });
    socket.on("shipment:predictionsUpdated", (p) => {
      if (p?.shipmentId === id) {
        setPredictionsLoading(false);
        queryClient.invalidateQueries({ queryKey: ["shipment", id] });
        toast.success("ML predictions updated");
      }
    });
    socket.on("shipment:optimized", (p) => { if (p?.shipmentId === id) queryClient.invalidateQueries({ queryKey: ["shipment", id] }); });
    socket.on("shipment:statusUpdate", (p) => { if (p?.shipmentId === id) queryClient.invalidateQueries({ queryKey: ["shipment", id] }); });

    return () => {
      socket.off("shipment:created");
      socket.off("shipment:predictionsUpdated");
      socket.off("shipment:optimized");
      socket.off("shipment:statusUpdate");
    };
  }, [token, id, queryClient]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const optimizeMutation = useMutation({
    mutationFn: () => shipmentService.optimize(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipment", id] });
      // Store ranked results for "Book this truck" buttons
      if (data?.results?.results?.length > 0) {
        setOptimResults(data.results.results);
        toast.success(`Optimization complete — ${data.results.results.length} trucks ranked`);
      } else {
        toast.success("Optimization complete");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const bookingMutation = useMutation({
    mutationFn: bookingService.create,
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["shipment", id] });
      setOptimResults(null);
      toast.success("Booking created — awaiting dealer approval");
      if (booking?.id) navigate(`/bookings/${booking.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => shipmentService.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipment", id] }); toast.success("Shipment cancelled"); },
  });

  const shipment = shipmentQuery.data;

  if (!shipment) return <EmptyState title="Shipment not found" message="The backend did not return this shipment." />;

  const canBook = user?.role === "WAREHOUSE" || user?.role === "CARGO_DEALER";
  const canOptimize = user?.role === "WAREHOUSE" || user?.role === "CARGO_DEALER" || user?.role === "ADMIN";
  const canCancel = (user?.role === "WAREHOUSE" || user?.role === "CARGO_DEALER" || user?.role === "ADMIN") && shipment.status !== "CANCELLED" && shipment.status !== "DELIVERED" && shipment.status !== "IN_TRANSIT";
  const displayPredictions = shipment.predictions || [];
  const distKm = haversineKm(shipment.pickupLocation?.lat, shipment.pickupLocation?.lng, shipment.destination?.lat, shipment.destination?.lng);

  // Merge optimization results with available trucks for richer display
  const trucksToShow = optimResults
    ? optimResults.slice(0, 5).map((r) => ({
      ...r,
      _fromOptim: true,
      id: r.truckId,
    }))
    : (availableQuery.data?.items || []).slice(0, 5);

  return (
    <Page
      title={shipment.description || "Shipment detail"}
      subtitle={`${shipment.pickupLocation?.city || shipment.pickupLocation?.address} → ${shipment.destination?.city || shipment.destination?.address}${distKm ? ` · ${formatNumber(distKm)} km` : ""}`}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        {/* ── Left: shipment info + predictions ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Shipment details"
              subtitle={`Created ${formatDate(shipment.createdAt)}`}
              actions={<StatusBadge status={shipment.status} />}
            />
            <KeyValue
              items={[
                { label: "Weight", value: `${formatNumber(shipment.weightKg)} kg` },
                { label: "Volume", value: `${formatNumber(shipment.volumeM3)} m³` },
                { label: "Boxes", value: shipment.boxes || "—" },
                { label: "Deadline", value: formatDate(shipment.deadline) },
                { label: "Pickup", value: shipment.pickupLocation?.address },
                { label: "Destination", value: shipment.destination?.address },
              ]}
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {canOptimize && shipment.status !== "CANCELLED" && shipment.status !== "DELIVERED" ? (
                <Button icon={Sparkles} loading={optimizeMutation.isPending} onClick={() => optimizeMutation.mutate()}>
                  {optimResults ? "Re-run optimization" : "Run optimization"}
                </Button>
              ) : null}
              {canCancel ? (
                <Button variant="danger" icon={XCircle} loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </Card>

          {/* ── ML Predictions ── */}
          <Card>
            <CardHeader
              title="ML Predictions"
              subtitle="Auto-generated from shipment data"
              actions={predictionsLoading ? (
                <span className="flex items-center gap-1.5 text-xs text-blue-600">
                  <BrainCircuit className="h-3 w-3 animate-pulse" /> Running...
                </span>
              ) : null}
            />
            {displayPredictions.length === 0 && !predictionsLoading ? (
              <p className="text-sm text-slate-400 py-2">No predictions yet — run optimization or wait for auto-generation.</p>
            ) : null}
            {predictionsLoading && displayPredictions.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse flex justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-3">
              {displayPredictions.map((p) => {
                const meta = PREDICTION_LABELS[p.type] || { label: p.type, format: (v) => v };
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div>
                      <div className="font-medium text-sm">{meta.label}</div>
                      <div className="text-xs text-slate-400">{p.modelVersion || "ML"} · confidence {p.confidence != null ? percent(p.confidence * 100) : "—"}</div>
                    </div>
                    <div className="text-right font-semibold">{meta.format(p.value)}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Right: trucks + bookings ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={optimResults ? "Optimization results" : "Available trucks"}
              subtitle={optimResults
                ? `${optimResults.length} trucks ranked by score — book the best match`
                : "All available trucks from the fleet"}
              actions={optimResults ? (
                <button onClick={() => setOptimResults(null)} className="text-xs text-slate-400 hover:text-slate-600">
                  Show all trucks
                </button>
              ) : null}
            />
            <div className="space-y-4">
              {trucksToShow.length === 0 ? (
                <EmptyState icon={Box} title="No trucks available" message="No trucks match this shipment's requirements right now." />
              ) : trucksToShow.map((truck) => {
                const isOptim = truck._fromOptim;
                const score = isOptim ? truck.score : null;
                const truckId = isOptim ? truck.truckId : truck.id;
                const regNo = isOptim ? truck.registrationNo : truck.registrationNo;
                const capKg = isOptim ? truck.capacityKg : truck.capacityKg;
                const capM3 = isOptim ? truck.capacityM3 : truck.capacityM3;
                const truckType = isOptim ? truck.truckType : truck.truckType;
                const routeFrom = isOptim ? truck.routeFrom : truck.routeFrom;
                const routeTo = isOptim ? truck.routeTo : truck.routeTo;
                const pricePerKm = isOptim ? truck.pricePerKm : truck.pricePerKm;
                const dealerName = isOptim ? truck.dealer?.company : truck.dealer?.company;
                const estimatedCost = isOptim ? truck.estimatedCost : (distKm && pricePerKm ? distKm * pricePerKm : null);

                return (
                  <div key={truckId} className={`rounded-2xl border p-4 ${isOptim && score > 0.8 ? "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-500/5" : "border-slate-200 dark:border-slate-800"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{regNo}</div>
                          {isOptim && score != null ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${score > 0.8 ? "bg-blue-100 text-blue-700" : score > 0.6 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                              Score {percent(score * 100)}
                            </span>
                          ) : null}
                          {isOptim && truck.mlRecommended ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> ML pick
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {truckType} · {routeFrom} → {routeTo}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatNumber(capKg)} kg cap
                          {capM3 ? ` · ${formatNumber(capM3)} m³` : ""}
                          {pricePerKm ? ` · ₹${pricePerKm}/km` : ""}
                          {dealerName ? ` · ${dealerName}` : ""}
                        </div>
                        {estimatedCost ? (
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Est. cost: {formatCurrency(estimatedCost)}
                          </div>
                        ) : null}
                      </div>
                      {canBook ? (
                        <Button
                          variant={isOptim && score > 0.8 ? "primary" : "secondary"}
                          loading={bookingMutation.isPending}
                          onClick={() => bookingMutation.mutate({
                            shipmentId: shipment.id,
                            truckId,
                            optimScore: score ?? 0.8,
                            notes: isOptim ? `Optimization score: ${percent(score * 100)}` : "Booked from available fleet",
                          })}
                        >
                          Book
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <ProgressBar value={Math.min((shipment.weightKg / (capKg || 1)) * 100, 100)} label="Weight utilization" />
                      <ProgressBar value={Math.min(((shipment.volumeM3 || 0) / (capM3 || 1)) * 100, 100)} label="Volume utilization" />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Bookings on this shipment ── */}
          <Card>
            <CardHeader title="Bookings" subtitle="Booking history for this shipment" />
            <div className="space-y-3">
              {(shipment.bookings || []).length === 0 ? (
                <EmptyState icon={Box} title="No bookings yet" message="Run optimization and book a truck above." />
              ) : shipment.bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => navigate(`/bookings/${b.id}`)}
                >
                  <div>
                    <div className="font-medium text-sm">{b.truck?.registrationNo || "Truck"}</div>
                    <div className="text-xs text-slate-400">{b.truck?.truckType} · {formatCurrency(b.pricing?.total)}</div>
                    <div className="text-xs text-slate-400">{formatDate(b.createdAt)}</div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
