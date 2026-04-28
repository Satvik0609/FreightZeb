import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Box, Fuel, GaugeCircle, Layers3, Route, Truck } from "lucide-react";
import { mlService } from "../services/mlService";
import { shipmentService } from "../services/shipmentService";
import { bookingService } from "../services/bookingService";
import { cargoTypes, formatAgo, formatCurrency, formatNumber, percent, priorities, timeOfDayOptions, trafficConditions, truckTypes, weatherConditions } from "../lib/utils";
import { Badge, Button, Card, CardHeader, Gauge, Input, LoadingGrid, Page, ProgressBar, Select, StatCard, Timeline } from "../components/ui/primitives";

export default function MlInsightsPage() {
  const [truckForm, setTruckForm] = useState({ weight_kg: 5000, volume_m3: 20, distance_km: 800, cargo_type: "GENERAL", priority: "NORMAL" });
  const [fuelForm, setFuelForm] = useState({ distance_km: 300, weight_kg: 4000, truck_type: "REEFER" });
  const [cargoForm, setCargoForm] = useState({
    truck_capacity_kg: 10000,
    truck_capacity_m3: 50,
    items: [
      { id: "i1", weight_kg: 1000, volume_m3: 5, value: 1000 },
      { id: "i2", weight_kg: 1500, volume_m3: 6, value: 1500 },
      { id: "i3", weight_kg: 800, volume_m3: 3, value: 900 },
    ],
  });

  const bookingsQuery = useQuery({ queryKey: ["ml-bookings"], queryFn: () => bookingService.listAll({}) });
  const shipmentsQuery = useQuery({ queryKey: ["ml-cluster-source"], queryFn: () => shipmentService.listAll({ status: "PENDING" }) });
  const modelsQuery = useQuery({ queryKey: ["ml-models"], queryFn: mlService.modelsInfo });

  const truckMutation = useMutation({ mutationFn: () => mlService.predict({ prediction_type: "truck", ...truckForm }) });
  const fuelMutation = useMutation({ mutationFn: () => mlService.estimateFuel(fuelForm) });
  const cargoMutation = useMutation({ mutationFn: () => mlService.optimizeCargo(cargoForm) });

  const selectedShipment = shipmentsQuery.data?.items?.[0];
  const selectedBookedShipment = useMemo(() => {
    const first = bookingsQuery.data?.items?.find((item) => item.shipmentId);
    return first?.shipmentId;
  }, [bookingsQuery.data]);

  const deliveryQuery = useQuery({
    queryKey: ["ml-delivery", selectedBookedShipment],
    queryFn: () => mlService.predictDelivery(selectedBookedShipment, { weather: "CLEAR", traffic: "MODERATE" }),
    enabled: Boolean(selectedBookedShipment),
  });

  const delayQuery = useQuery({
    queryKey: ["ml-delay", selectedBookedShipment],
    queryFn: () => mlService.predictDelay(selectedBookedShipment, { weather: "STORM", traffic: "HEAVY", time_of_day: "NIGHT" }),
    enabled: Boolean(selectedBookedShipment),
  });

  const clusterQuery = useQuery({
    queryKey: ["ml-clusters"],
    queryFn: () => shipmentService.getClusters({ status: "PENDING" }),
  });

  if (modelsQuery.isLoading) return <LoadingGrid count={6} />;

  const modelCard = (key, model) => (
    <div key={key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div className="font-medium">{key}</div>
        <Badge>{model.algorithm}</Badge>
      </div>
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Last updated: {formatAgo(new Date().toISOString())}</div>
      <div className="mt-3 space-y-2">
        {Object.entries(model).filter(([entry]) => entry !== "algorithm").map(([metric, value]) => (
          <div key={metric} className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{metric}</span>
            <span className="font-medium">{value ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Page title="ML Insights" subtitle="AI control center using the backend ML integration and persisted shipment context.">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Truck recommender" subtitle="Unified prediction endpoint" eyebrow="Primary" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Weight kg" value={truckForm.weight_kg} onChange={(event) => setTruckForm({ ...truckForm, weight_kg: Number(event.target.value) })} />
              <Input label="Volume m3" value={truckForm.volume_m3} onChange={(event) => setTruckForm({ ...truckForm, volume_m3: Number(event.target.value) })} />
              <Input label="Distance km" value={truckForm.distance_km} onChange={(event) => setTruckForm({ ...truckForm, distance_km: Number(event.target.value) })} />
              <Select label="Priority" value={truckForm.priority} onChange={(event) => setTruckForm({ ...truckForm, priority: event.target.value })}>{priorities.map((item) => <option key={item}>{item}</option>)}</Select>
              <Select label="Cargo type" value={truckForm.cargo_type} onChange={(event) => setTruckForm({ ...truckForm, cargo_type: event.target.value })}>{cargoTypes.map((item) => <option key={item}>{item}</option>)}</Select>
            </div>
            <div className="mt-4">
              <Button loading={truckMutation.isPending} onClick={() => truckMutation.mutate()}>Run recommendation</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Fuel estimator" subtitle="Backend ML GET endpoint" />
            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Distance km" value={fuelForm.distance_km} onChange={(event) => setFuelForm({ ...fuelForm, distance_km: Number(event.target.value) })} />
              <Input label="Weight kg" value={fuelForm.weight_kg} onChange={(event) => setFuelForm({ ...fuelForm, weight_kg: Number(event.target.value) })} />
              <Select label="Truck type" value={fuelForm.truck_type} onChange={(event) => setFuelForm({ ...fuelForm, truck_type: event.target.value })}>{truckTypes.map((item) => <option key={item}>{item}</option>)}</Select>
            </div>
            <div className="mt-4">
              <Button variant="secondary" loading={fuelMutation.isPending} onClick={() => fuelMutation.mutate()}>Estimate fuel</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cargo optimizer" subtitle="Live ML service only, no heuristic simulation." />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Truck capacity kg" value={cargoForm.truck_capacity_kg} onChange={(event) => setCargoForm({ ...cargoForm, truck_capacity_kg: Number(event.target.value) })} />
              <Input label="Truck capacity m3" value={cargoForm.truck_capacity_m3} onChange={(event) => setCargoForm({ ...cargoForm, truck_capacity_m3: Number(event.target.value) })} />
            </div>
            <div className="mt-4">
              <Button variant="secondary" loading={cargoMutation.isPending} onClick={() => cargoMutation.mutate()}>Optimize cargo</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Model registry" subtitle="Accuracy and metadata proxied from the backend ML controller." />
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(modelsQuery.data?.models || {}).map(([key, model]) => modelCard(key, model))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Output workspace" subtitle="No raw JSON panels. Every result is transformed into a visual surface." />
            <div className="grid gap-6 md:grid-cols-2">
              <StatCard title="Recommended truck" value={truckMutation.data?.result?.recommended_truck || "—"} hint={truckMutation.data?.result?.fallback ? "Fallback: true" : "Fallback: false"} icon={Truck} />
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="mb-3 font-medium">Recommendation confidence</div>
                <ProgressBar value={(truckMutation.data?.result?.confidence || 0) * 100} />
              </div>
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="mb-3 font-medium">Delivery timeline</div>
                <Timeline
                  items={[
                    { label: "Prediction requested", active: true, caption: "Shipment-linked endpoint" },
                    { label: "Expected departure", active: true, caption: "Derived from booking route" },
                    { label: "Expected arrival", active: true, caption: `${deliveryQuery.data?.result?.predicted_hours || "—"} hours` },
                  ]}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <Gauge value={delayQuery.data?.result?.delay_probability || 0} label={delayQuery.data?.result?.risk_level || "Delay risk"} subtitle={`Fallback: ${String(Boolean(delayQuery.data?.result?.fallback))}`} />
              </div>
              <StatCard title="Fuel liters" value={formatNumber(fuelMutation.data?.result?.estimated_liters)} hint={fuelMutation.data?.result?.fallback ? "Fallback: true" : "Fallback: false"} icon={Fuel} />
              <StatCard title="Fuel cost" value={formatCurrency(fuelMutation.data?.result?.estimated_cost, "USD")} hint={`CO2 ${formatNumber(fuelMutation.data?.result?.co2_kg)} kg`} icon={GaugeCircle} />
              <StatCard title="Cargo utilization" value={percent(cargoMutation.data?.result?.utilization_percent)} hint={`Loaded ${formatNumber(cargoMutation.data?.result?.total_weight)} kg`} icon={Box} />
              <StatCard title="Loaded items" value={cargoMutation.data?.result?.loaded_items?.length || 0} hint={`Skipped ${cargoMutation.data?.result?.skipped_items?.length || 0}`} icon={Layers3} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Shipment clustering" subtitle="Colored points by ML clustering result." />
            <div className="h-[340px]">
              <MapContainer center={[20.5937, 78.9629]} zoom={4} scrollWheelZoom>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {(clusterQuery.data?.result?.clusters || []).flatMap((cluster, index) =>
                  (cluster.shipments || []).map((shipment) => (
                    <CircleMarker key={shipment.id} center={[shipment.latitude, shipment.longitude]} radius={8} pathOptions={{ color: ["#2563eb", "#7c3aed", "#059669", "#f59e0b"][index % 4] }}>
                      <Popup>{shipment.id}</Popup>
                    </CircleMarker>
                  )),
                )}
              </MapContainer>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
