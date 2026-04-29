import { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { Radio, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = { width: '100%', height: '380px' };

const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India center

/**
 * LiveTrackingMap
 * - WAREHOUSE / ADMIN: read-only, auto-updates via socket when dealer pushes location
 * - DEALER / CARGO_DEALER: same map but also shows their own pushes reflected instantly
 *
 * Props:
 *   bookingId  — required
 *   isActive   — boolean, whether booking is PICKED_UP or IN_TRANSIT
 */
export default function LiveTrackingMap({ bookingId, isActive }) {
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [isLive, setIsLive] = useState(false);
    const [logs, setLogs] = useState([]);
    const mapRef = useRef(null);
    const queryClient = useQueryClient();
    const token = useAuthStore((s) => s.token);

    // Initial fetch of tracking history
    const { data, isLoading } = useQuery({
        queryKey: ['tracking', bookingId],
        queryFn: async () => {
            const res = await api.get(`/tracking/${bookingId}/history`);
            return res.data;
        },
        enabled: !!bookingId,
        refetchInterval: isActive ? 60000 : false,
    });

    // Sync logs from query data
    useEffect(() => {
        if (data?.trackingLogs?.length > 0) {
            setLogs(data.trackingLogs);
            const latest = data.trackingLogs[data.trackingLogs.length - 1];
            const center = { lat: latest.latitude, lng: latest.longitude };
            setMapCenter(center);
            if (mapRef.current) {
                mapRef.current.panTo(center);
                mapRef.current.setZoom(10);
            }
        }
    }, [data]);

    // Real-time socket updates
    useEffect(() => {
        if (!bookingId || !token || !isActive) return;

        const socket = getSocket(token);
        if (!socket.connected) socket.connect();

        const room = `booking:${bookingId}`;
        socket.emit('join', room);

        const onConnect = () => socket.emit('join', room);

        const onUpdate = (update) => {
            setIsLive(true);
            const newLog = {
                id: update.timestamp,
                bookingId: update.bookingId,
                truckId: update.truckId,
                latitude: update.latitude,
                longitude: update.longitude,
                status: update.status,
                timestamp: update.timestamp,
            };

            setLogs((prev) => [...prev, newLog]);

            const center = { lat: update.latitude, lng: update.longitude };
            setMapCenter(center);
            if (mapRef.current) mapRef.current.panTo(center);

            // Keep global tracking query in sync too
            queryClient.setQueryData(['tracking', bookingId], (old) => {
                if (!old) return old;
                return { ...old, status: update.status, trackingLogs: [...old.trackingLogs, newLog] };
            });
        };

        socket.on('connect', onConnect);
        socket.on('tracking:update', onUpdate);

        return () => {
            socket.emit('leave', room);
            socket.off('connect', onConnect);
            socket.off('tracking:update', onUpdate);
            setIsLive(false);
        };
    }, [bookingId, token, isActive, queryClient]);

    const pathCoordinates = logs.map((l) => ({ lat: l.latitude, lng: l.longitude }));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                Loading map...
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                <MapPin className="w-8 h-8" />
                <span className="text-sm">No location data yet</span>
                {isActive && <span className="text-xs">Waiting for dealer to push location</span>}
            </div>
        );
    }

    return (
        <div>
            {isActive && (
                <div className="flex items-center gap-2 mb-2">
                    {isLive ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Radio className="w-3 h-3 animate-pulse" />
                            LIVE
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400">Connecting to live feed...</span>
                    )}
                    <span className="text-xs text-slate-500">{logs.length} location update{logs.length !== 1 ? 's' : ''}</span>
                </div>
            )}

            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={8}
                    onLoad={(map) => { mapRef.current = map; }}
                    options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
                >
                    {pathCoordinates.length > 1 && (
                        <Polyline
                            path={pathCoordinates}
                            options={{ strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 3 }}
                        />
                    )}

                    {logs.map((log, index) => {
                        const isLatest = index === logs.length - 1;
                        const isFirst = index === 0;
                        const iconUrl = isLatest
                            ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                            : isFirst
                                ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                                : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';

                        return (
                            <Marker
                                key={`${log.id}-${index}`}
                                position={{ lat: log.latitude, lng: log.longitude }}
                                icon={iconUrl}
                                zIndex={isLatest ? 999 : index}
                                onClick={() => setSelectedMarker(log)}
                            />
                        );
                    })}

                    {selectedMarker && (
                        <InfoWindow
                            position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
                            onCloseClick={() => setSelectedMarker(null)}
                        >
                            <div className="p-1 text-sm">
                                <p className="font-semibold">{selectedMarker.status?.replace('_', ' ')}</p>
                                <p className="text-gray-500 text-xs mt-1">
                                    {format(new Date(selectedMarker.timestamp), 'MMM dd, HH:mm')}
                                </p>
                                <p className="text-gray-400 text-xs">
                                    {selectedMarker.latitude.toFixed(5)}, {selectedMarker.longitude.toFixed(5)}
                                </p>
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            </LoadScript>

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Pickup</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> En route</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Current</span>
            </div>
        </div>
    );
}
