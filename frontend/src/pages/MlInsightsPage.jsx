import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import {
  BrainCircuit, Box, Fuel, GaugeCircle, Layers3, Truck, Zap, RefreshCw,
  Thermometer, Wind, Clock, Leaf, CheckCircle2, AlertTriangle, Activity,
} from "lucide-react";
import { mlService } from "../services/mlService";
import { shipmentService } from "../services/shipmentService";
import { truckService } from "../services/truckService";
import {
  formatAgo, formatCurrency, formatNumber, haversineKm, percent,
} from "../lib/utils";
import {
  Badge, Button, Card, CardHeader, LoadingGrid, Page,
  ProgressBar, Select,
} from "../components/ui/primitives";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

// ── helpers ───────────────────────────────────────────────────────────────────
function inferCargoType(req) {
  if (req?.tempControlled) return "REFRIGERATED";
  if (req?.hazardous) return "HAZARDOUS";
  if (req?.fragile) return "FRAGILE";
  return "GENERAL";
}

const MODEL_LABELS = {
  truck_recommender: "Truck Recommender",
  delivery_predictor: "Delivery Predictor",
  fuel_estimator: "Fuel Estimator",
  delay_predictor: "Delay Predictor",
  route_optimizer: "Route Optimizer",
};

// ── Radial confidence ring ────────────────────────────────────────────────────
function ConfidenceRing({ value = 0 }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value));
  const dash = pct * circumference;
  const color = pct >= 0.75 ? "#10b981" : pct >= 0.5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" className="dark:stroke-slate-700" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor" className="fill-slate-800 dark:fill-slate-100">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className="text-xs text-slate-500 dark:text-slate-400">Confidence</span>
    </div>
  );
}

// ── Cargo donut chart ─────────────────────────────────────────────────────────
function DonutChart({ value = 0 }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" className="dark:stroke-slate-700" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="48" y="53" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor" className="fill-slate-800 dark:fill-slate-100">
          {Math.round(pct)}%
        </text>
      </svg>
      <span className="text-xs text-slate-500 dark:text-slate-400">Utilization</span>
    </div>
  );
}

// ── Delay risk gauge bar ──────────────────────────────────────────────────────
function DelayGauge({ value = 0, label }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct < 30 ? "from-emerald-500 to-green-400" : pct < 60 ? "from-amber-500 to-yellow-400" : "from-rose-600 to-red-500";
  const textColor = pct < 30 ? "text-emerald-600 dark:text-emerald-400" : pct < 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  const Icon = pct < 30 ? CheckCircle2 : AlertTriangle;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Delay Risk</span>
        <span className={`text-2xl font-bold ${textColor}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-4 rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`flex items-center gap-1.5 text-sm font-medium ${textColor}`}>
        <Icon className="h-4 w-4" />
        {label || (pct < 30 ? "LOW RISK" : pct < 60 ? "MODERATE RISK" : "HIGH RISK")}
      </div>
    </div>
  );
}

// ── Condition pill button ─────────────────────────────────────────────────────
function ConditionGroup({ label, icon: Icon, options, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={[
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150",
              value === opt
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            ].join(" ")}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Glassmorphism selector card ───────────────────────────────────────────────
function SelectorCard({ icon: Icon, title, badge, children, meta }) {
  return (
    <div className="relative rounded-2xl border border-white/20 bg-white/70 p-5 shadow-lg backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/70">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      {children}
      {meta && (
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.map((chip, i) => (
            <span key={i} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MlInsightsPage() {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [running, setRunning] = useState(false);
  const [weather, setWeather] = useState("CLEAR");
  const [traffic, setTraffic] = useState("MODERATE");
  const [timeOfDay, setTimeOfDay] = useState("AFTERNOON");

  const [truckResult, setTruckResult] = useState(null);
  const [etaResult, setEtaResult] = useState(null);
  const [delayResult, setDelayResult] = useState(null);
  const [fuelResult, setFuelResult] = useState(null);
  const [cargoResult, setCargoResult] = useState(null);

  // ── queries ────────────────────────────────────────────────────────────────
  const shipmentsQuery = useQuery({
    queryKey: ["ml-shipments", user?.role],
    queryFn: () => {
      if (user?.role === "ADMIN") return shipmentService.listAll({});
      if (user?.role === "DEALER") return shipmentService.listAvailable({ limit: 50 });
      return shipmentService.listMine({});
    },
    staleTime: 30_000,
    enabled: Boolean(user),
  });
  const trucksQuery = useQuery({
    queryKey: ["ml-trucks"],
    queryFn: () => truckService.listAvailable({}),
    staleTime: 30_000,
  });
  const modelsQuery = useQuery({
    queryKey: ["ml-models"],
    queryFn: mlService.modelsInfo,
    staleTime: 60_000,
  });
  const clusterQuery = useQuery({
    queryKey: ["ml-clusters"],
    queryFn: () => shipmentService.getClusters({ status: "PENDING" }),
    staleTime: 60_000,
    enabled: Boolean(user) && user?.role !== "DEALER",
  });

  // ── retrain mutation ───────────────────────────────────────────────────────
  const retrainMutation = useMutation({
    mutationFn: () => import("../services/http").then(({ post }) => post("/ml/retrain", {})),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ml-models"] });
      const summary = Object.entries(data.results || {})
        .map(([k, v]) => `${k.replace("_", " ")}: ${v.status}`)
        .join(" · ");
      toast.success(`Retrain complete — ${summary || "done"}`);
    },
    onError: (err) => toast.error(`Retrain failed: ${err.message}`),
  });

  const shipments = shipmentsQuery.data?.items || [];
  const trucks = trucksQuery.data?.items || [];

  // ── auto-select ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (shipments.length > 0 && !selectedShipmentId) {
      setSelectedShipmentId(shipments[0].id);
    }
  }, [shipments, selectedShipmentId]);

  useEffect(() => {
    if (trucks.length > 0 && !selectedTruckId) {
      setSelectedTruckId(trucks[0].id);
    }
  }, [trucks, selectedTruckId]);

  // ── socket: new shipment ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const handler = (payload) => {
      queryClient.invalidateQueries({ queryKey: ["ml-shipments"] });
      if (payload?.shipmentId) setSelectedShipmentId(payload.shipmentId);
    };
    socket.on("shipment:created", handler);
    return () => socket.off("shipment:created", handler);
  }, [token, queryClient]);

  // ── socket: join shipment room + listen for prediction updates ────────────
  useEffect(() => {
    if (!token || !selectedShipmentId) return;
    const socket = getSocket(token);
    socket.emit("join", `shipment:${selectedShipmentId}`);
    const handler = (payload) => {
      if (payload?.shipmentId === selectedShipmentId) {
        runAllPredictions(selectedShipmentId, selectedTruckId, weather, traffic, timeOfDay);
      }
    };
    socket.on("shipment:predictionsUpdated", handler);
    return () => {
      socket.emit("leave", `shipment:${selectedShipmentId}`);
      socket.off("shipment:predictionsUpdated", handler);
    };
  }, [token, selectedShipmentId, selectedTruckId, weather, traffic, timeOfDay]);

  // ── core prediction runner ─────────────────────────────────────────────────
  const runningRef = useRef(false);

  async function runAllPredictions(shipmentId, truckId, wx, traf, tod) {
    if (!shipmentId || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setTruckResult(null);
    setEtaResult(null);
    setDelayResult(null);
    setFuelResult(null);

    const shipment = shipments.find((s) => s.id === shipmentId);
    if (!shipment) { runningRef.current = false; setRunning(false); return; }

    const truck = trucks.find((t) => t.id === truckId);
    const distKm = haversineKm(
      shipment.pickupLocation?.lat, shipment.pickupLocation?.lng,
      shipment.destination?.lat, shipment.destination?.lng,
    ) || 700;
    const cargoType = inferCargoType(shipment.requirements);
    const truckType = truck?.truckType || "CONTAINER_20FT";

    const [tr, eta, delay, fuel] = await Promise.allSettled([
      mlService.predict({
        prediction_type: "truck",
        weight_kg: shipment.weightKg,
        volume_m3: shipment.volumeM3 ?? 1,
        distance_km: distKm,
        cargo_type: cargoType,
        priority: shipment.deadline ? "URGENT" : "NORMAL",
      }),
      mlService.predictDelivery(shipmentId, { weather: wx, traffic: traf }),
      mlService.predictDelay(shipmentId, { weather: wx, traffic: traf, time_of_day: tod }).catch(() =>
        mlService.predict({
          prediction_type: "delay",
          distance_km: distKm,
          weight_kg: shipment.weightKg,
          truck_type: truckType,
          weather_condition: wx,
          traffic_condition: traf,
          time_of_day: tod,
        })
      ),
      mlService.estimateFuel({ distance_km: distKm, weight_kg: shipment.weightKg, truck_type: truckType }),
    ]);

    if (tr.status === "fulfilled") setTruckResult(tr.value?.result ?? tr.value);
    if (eta.status === "fulfilled") setEtaResult(eta.value?.result ?? eta.value);
    if (delay.status === "fulfilled") setDelayResult(delay.value?.result ?? delay.value);
    if (fuel.status === "fulfilled") setFuelResult(fuel.value?.result ?? fuel.value);

    if (truck && shipment.weightKg) {
      try {
        const items = [{ id: shipmentId, weight_kg: shipment.weightKg, volume_m3: shipment.volumeM3 ?? 1, value: 1000 }];
        const cargo = await mlService.optimizeCargo({
          truck_capacity_kg: truck.capacityKg,
          truck_capacity_m3: truck.capacityM3 ?? 50,
          items,
        });
        setCargoResult(cargo?.result ?? cargo);
      } catch (_) { }
    }

    runningRef.current = false;
    setRunning(false);
  }

  // ── trigger on selection / condition change (debounced 600ms) ────────────
  useEffect(() => {
    if (!selectedShipmentId || shipments.length === 0) return;
    const timer = setTimeout(() => {
      runAllPredictions(selectedShipmentId, selectedTruckId, weather, traffic, timeOfDay);
    }, 600);
    return () => clearTimeout(timer);
  }, [selectedShipmentId, selectedTruckId, weather, traffic, timeOfDay, shipments.length]);

  if (modelsQuery.isLoading) return <LoadingGrid count={6} />;

  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);
  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
  const distKm = selectedShipment
    ? haversineKm(
      selectedShipment.pickupLocation?.lat, selectedShipment.pickupLocation?.lng,
      selectedShipment.destination?.lat, selectedShipment.destination?.lng,
    )
    : null;

  // ── status badge ───────────────────────────────────────────────────────────
  const statusBadge = running ? (
    <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
      <Zap className="h-3 w-3 animate-pulse" />
      Running models...
    </span>
  ) : selectedShipmentId ? (
    <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" />
      Ready
    </span>
  ) : null;

  return (
    <Page
      title="ML Insights"
      subtitle="Real-time predictions across all models for the selected shipment."
      actions={
        user?.role === "ADMIN" ? (
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={retrainMutation.isPending}
            onClick={() => retrainMutation.mutate()}
          >
            Retrain on DB data
          </Button>
        ) : null
      }
    >
      {/* ── Context bar ── */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <SelectorCard
          icon={BrainCircuit}
          title="Shipment context"
          badge={statusBadge}
          meta={selectedShipment ? [
            `${formatNumber(selectedShipment.weightKg)} kg`,
            `${formatNumber(selectedShipment.volumeM3)} m³`,
            ...(distKm ? [`${formatNumber(distKm)} km`] : []),
            selectedShipment.status,
          ] : undefined}
        >
          <Select
            value={selectedShipmentId}
            onChange={(e) => setSelectedShipmentId(e.target.value)}
          >
            <option value="">— select shipment —</option>
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.description || s.id.slice(0, 8)} · {s.pickupLocation?.city || "?"} → {s.destination?.city || "?"} · {formatNumber(s.weightKg)} kg
              </option>
            ))}
          </Select>
        </SelectorCard>

        <SelectorCard
          icon={Truck}
          title="Truck context"
          meta={selectedTruck ? [
            selectedTruck.truckType,
            `${formatNumber(selectedTruck.capacityKg)} kg cap`,
            `${selectedTruck.routeFrom || "?"} → ${selectedTruck.routeTo || "?"}`,
          ] : undefined}
        >
          <Select
            value={selectedTruckId}
            onChange={(e) => setSelectedTruckId(e.target.value)}
          >
            <option value="">— select truck —</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.registrationNo} · {t.truckType} · {formatNumber(t.capacityKg)} kg
              </option>
            ))}
          </Select>
        </SelectorCard>
      </div>

      {/* ── Conditions bar ── */}
      <div className="mb-6 flex flex-wrap items-start gap-6 rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/40">
        <ConditionGroup
          label="Weather"
          icon={Thermometer}
          options={["CLEAR", "RAIN", "STORM"]}
          value={weather}
          onChange={setWeather}
        />
        <div className="hidden h-10 w-px self-center bg-slate-200 dark:bg-slate-700 md:block" />
        <ConditionGroup
          label="Traffic"
          icon={Activity}
          options={["LIGHT", "MODERATE", "HEAVY", "SEVERE"]}
          value={traffic}
          onChange={setTraffic}
        />
        <div className="hidden h-10 w-px self-center bg-slate-200 dark:bg-slate-700 md:block" />
        <ConditionGroup
          label="Time of Day"
          icon={Clock}
          options={["MORNING", "AFTERNOON", "EVENING", "NIGHT"]}
          value={timeOfDay}
          onChange={setTimeOfDay}
        />
      </div>

      {/* ── 2x2 prediction cards ── */}
      <div className="mb-6 grid gap-5 md:grid-cols-2">

        {/* Card A: Truck Recommendation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-indigo-50 p-2 dark:bg-indigo-500/10">
              <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Truck Recommendation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Best truck type for this shipment</p>
            </div>
            {running && <span className="ml-auto animate-pulse text-xs text-blue-500">computing...</span>}
          </div>
          <div className="flex items-center gap-6">
            <ConfidenceRing value={truckResult?.confidence ?? 0} />
            <div className="flex-1 space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Recommended type</div>
                <div className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  {truckResult?.recommended_truck || "—"}
                </div>
              </div>
              {truckResult?.fallback && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Heuristic fallback
                </span>
              )}
              {truckResult && !truckResult.fallback && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  ML model
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card B: Delivery & Delay */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-500/10">
              <GaugeCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Delivery &amp; Delay</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">ETA and delay risk for current conditions</p>
            </div>
            {running && <span className="ml-auto animate-pulse text-xs text-blue-500">computing...</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">ETA</div>
              <div className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {etaResult?.predicted_hours != null ? formatNumber(etaResult.predicted_hours) : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">hours</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <DelayGauge
                value={delayResult?.delay_probability ?? 0}
                label={delayResult?.risk_level}
              />
            </div>
          </div>
        </div>

        {/* Card C: Fuel & Emissions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-green-50 p-2 dark:bg-green-500/10">
              <Fuel className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Fuel &amp; Emissions</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Estimated consumption and CO₂ for this route</p>
            </div>
            {running && <span className="ml-auto animate-pulse text-xs text-blue-500">computing...</span>}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fuel estimate</div>
              <div className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {fuelResult?.estimated_liters != null ? formatNumber(fuelResult.estimated_liters) : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">liters</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fuel cost</div>
              <div className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {fuelResult?.estimated_cost != null ? formatCurrency(fuelResult.estimated_cost, "INR") : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">estimated</div>
            </div>
          </div>
          <div className="rounded-xl bg-green-50/60 p-3 dark:bg-green-500/5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                <Leaf className="h-3.5 w-3.5" />
                CO₂ Emissions
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {(fuelResult?.co2_emissions_kg ?? fuelResult?.co2_kg) != null ? `${formatNumber(fuelResult.co2_emissions_kg ?? fuelResult.co2_kg)} kg` : "—"}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-green-100 dark:bg-green-900/30 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                style={{ width: (fuelResult?.co2_emissions_kg ?? fuelResult?.co2_kg) ? `${Math.min(100, ((fuelResult.co2_emissions_kg ?? fuelResult.co2_kg) / 500) * 100)}%` : "0%" }}
              />
            </div>
            {fuelResult?.efficiency_rating && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Efficiency: <span className="font-medium text-slate-700 dark:text-slate-200">{fuelResult.efficiency_rating}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card D: Cargo Optimizer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-purple-50 p-2 dark:bg-purple-500/10">
              <Box className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cargo Optimizer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Packing efficiency for selected truck</p>
            </div>
            {running && <span className="ml-auto animate-pulse text-xs text-blue-500">computing...</span>}
          </div>
          {!selectedTruckId ? (
            <div className="flex h-32 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-sm text-slate-400">Select a truck to run cargo optimization</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <DonutChart value={cargoResult?.utilization_percent ?? 0} />
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Items loaded</div>
                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {cargoResult?.loaded_items?.length ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Skipped</div>
                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {cargoResult?.skipped_items?.length ?? "—"}
                    </div>
                  </div>
                </div>
                {cargoResult?.total_weight != null && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Total weight: <span className="font-medium text-slate-700 dark:text-slate-200">{formatNumber(cargoResult.total_weight)} kg</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom section: Model Registry + Clustering ── */}
      <div className="grid gap-5 xl:grid-cols-2">

        {/* Model Registry */}
        <Card>
          <CardHeader
            title="Model Registry"
            subtitle="Live accuracy metrics from the ML service."
            eyebrow="Models"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(modelsQuery.data?.models || {}).map(([key, model]) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {MODEL_LABELS[key] || key}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {model.algorithm}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Loaded
                  </span>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(model)
                    .filter(([k]) => k !== "algorithm")
                    .map(([metric, value]) => {
                      const numVal = parseFloat(value);
                      const isPercent = metric === "accuracy" || metric === "r2" || metric === "f1_score";
                      const barVal = isPercent ? numVal * 100 : null;
                      return (
                        <div key={metric}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400 capitalize">{metric.replace(/_/g, " ")}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {value ?? "—"}
                            </span>
                          </div>
                          {barVal != null && (
                            <ProgressBar value={barVal} />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Shipment Clustering */}
        <Card>
          <CardHeader
            title="Shipment Clustering"
            subtitle="PENDING shipments grouped by destination proximity."
            eyebrow="Geo"
          />
          <div className="h-[340px] overflow-hidden rounded-2xl">
            <MapContainer center={[20.5937, 78.9629]} zoom={4} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {(clusterQuery.data?.result?.clusters || []).flatMap((cluster, index) =>
                (cluster.shipments || []).map((s, si) => (
                  <CircleMarker
                    key={`${index}-${s.id ?? si}`}
                    center={[s.latitude, s.longitude]}
                    radius={8}
                    pathOptions={{ color: ["#2563eb", "#7c3aed", "#059669", "#f59e0b"][index % 4] }}
                  >
                    <Popup>{s.id || `Cluster ${index + 1} · ${si + 1}`}</Popup>
                  </CircleMarker>
                ))
              )}
            </MapContainer>
          </div>
        </Card>
      </div>
    </Page>
  );
}
