import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Polyline, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { bookingService } from "../services/bookingService";
import { trackingService } from "../services/trackingService";
import { useAuthStore } from "../store/authStore";
import { formatDate } from "../lib/utils";
import { Card, CardHeader, EmptyState, Page, Select } from "../components/ui/primitives";

export default function TrackingPage() {
  const { user } = useAuthStore();
  const [bookingId, setBookingId] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["tracking-bookings", user?.role],
    queryFn: () => (user?.role === "DEALER" ? bookingService.listDealer({}) : user?.role === "ADMIN" ? bookingService.listAll({}) : bookingService.listMine({})),
  });

  useEffect(() => {
    const first = bookingsQuery.data?.items?.find((item) => item.status === "IN_TRANSIT" || item.status === "PICKED_UP") || bookingsQuery.data?.items?.[0];
    if (first && !bookingId) setBookingId(first.id);
  }, [bookingsQuery.data, bookingId]);

  const trackingQuery = useQuery({
    queryKey: ["tracking", bookingId],
    queryFn: () => trackingService.history(bookingId),
    enabled: Boolean(bookingId),
    refetchInterval: 15000,
  });

  const logs = trackingQuery.data?.trackingLogs || [];
  const center = logs[logs.length - 1] ? [logs[logs.length - 1].latitude, logs[logs.length - 1].longitude] : [20.5937, 78.9629];

  return (
    <Page
      title="Tracking"
      subtitle="Map and event trail fed by booking tracking logs and real-time updates."
      actions={
        <Select value={bookingId} onChange={(event) => setBookingId(event.target.value)} className="h-11 min-w-64">
          <option value="">Select booking</option>
          {(bookingsQuery.data?.items || []).map((booking) => (
            <option key={booking.id} value={booking.id}>{booking.id.slice(0, 8)} · {booking.status}</option>
          ))}
        </Select>
      }
    >
      {!bookingId ? (
        <EmptyState title="No booking selected" message="Pick a booking with available tracking logs." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-0">
            <div className="h-[620px] p-4">
              <MapContainer center={center} zoom={5} scrollWheelZoom className="rounded-2xl">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {logs.map((log) => (
                  <CircleMarker key={log.id} center={[log.latitude, log.longitude]} radius={7} pathOptions={{ color: "#2563eb" }}>
                    <Popup>{log.status || "Location"} · {formatDate(log.timestamp)}</Popup>
                  </CircleMarker>
                ))}
                {logs.length > 1 ? <Polyline positions={logs.map((log) => [log.latitude, log.longitude])} pathOptions={{ color: "#6366f1", weight: 4 }} /> : null}
              </MapContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tracking history" subtitle={`Status: ${trackingQuery.data?.status || "unknown"}`} />
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="font-medium">{log.status || "Location ping"}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {log.latitude}, {log.longitude}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{formatDate(log.timestamp)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}
