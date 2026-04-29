import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { MapPin, AlertCircle, Navigation } from 'lucide-react';
import { format } from 'date-fns';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const statusColors = {
    PENDING: '#94a3b8',
    PICKED_UP: '#3b82f6',
    IN_TRANSIT: '#f59e0b',
    DELIVERED: '#10b981',
    CANCELLED: '#ef4444',
};

export default function TrackingPageFinal() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookingId, setBookingId] = useState(searchParams.get('bookingId') || '');
    const [map, setMap] = useState(null);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    });

    const { data: trackingData, isLoading, error, refetch } = useQuery({
        queryKey: ['tracking', bookingId],
        queryFn: async () => {
            if (!bookingId) return null;
            const res = await api.get(`/tracking/${bookingId}/history`);
            console.log('✅ Tracking data:', res.data);
            return res.data;
        },
        enabled: !!bookingId,
        refetchInterval: 30000,
    });

    const handleSearch = (e) => {
        e.preventDefault();
        if (bookingId.trim()) {
            setSearchParams({ bookingId: bookingId.trim() });
            refetch();
        }
    };

    // Fit map to show all markers
    useEffect(() => {
        if (map && trackingData?.trackingLogs?.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            trackingData.trackingLogs.forEach(log => {
                bounds.extend(new window.google.maps.LatLng(log.latitude, log.longitude));
            });
            map.fitBounds(bounds);

            // Add padding
            setTimeout(() => {
                map.fitBounds(bounds, 100);
            }, 300);

            console.log('✅ Map bounds set for', trackingData.trackingLogs.length, 'points');
        }
    }, [map, trackingData]);

    if (!isLoaded) {
        return <div className="p-6 text-center">Loading Google Maps...</div>;
    }

    const pathCoordinates = trackingData?.trackingLogs?.map(log => ({
        lat: log.latitude,
        lng: log.longitude,
    })) || [];

    console.log('📍 Path coordinates:', pathCoordinates);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">🚛 Live Tracking</h1>
                <p className="text-gray-600">Real-time shipment tracking</p>
            </div>

            <form onSubmit={handleSearch} className="mb-6">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                        placeholder="Enter Booking ID"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                    />
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg">
                        Track
                    </button>
                </div>
            </form>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 inline mr-2" />
                    {error.message}
                </div>
            )}

            {isLoading && <div className="text-center py-12">Loading...</div>}

            {trackingData && !isLoading && (
                <div className="space-y-6">
                    {/* Status */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold">Booking: {trackingData.bookingId}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                                style={{ backgroundColor: statusColors[trackingData.status] }}
                            >
                                {trackingData.status.replace('_', ' ')}
                            </span>
                            <span className="text-gray-500 text-sm">
                                {trackingData.trackingLogs?.length || 0} updates
                            </span>
                        </div>
                    </div>

                    {/* MAP */}
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '600px' }}
                            center={{ lat: 20.5937, lng: 78.9629 }}
                            zoom={5}
                            onLoad={setMap}
                        >
                            {/* BLUE ROUTE LINE */}
                            {pathCoordinates.length > 1 && (
                                <Polyline
                                    path={pathCoordinates}
                                    options={{
                                        strokeColor: '#3b82f6',
                                        strokeOpacity: 1,
                                        strokeWeight: 5,
                                    }}
                                />
                            )}

                            {/* MARKERS - SIMPLE RED PINS */}
                            {trackingData.trackingLogs?.map((log, idx) => (
                                <Marker
                                    key={log.id}
                                    position={{ lat: log.latitude, lng: log.longitude }}
                                    label={String(idx + 1)}
                                />
                            ))}
                        </GoogleMap>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold mb-4">📍 Journey Timeline</h3>
                        {trackingData.trackingLogs?.slice().reverse().map((log, idx) => (
                            <div key={log.id} className="mb-4 pb-4 border-b last:border-0">
                                <div className="flex justify-between">
                                    <strong>{log.status.replace('_', ' ')}</strong>
                                    <span className="text-sm text-gray-500">
                                        {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    📍 {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                                </p>
                                {log.truckId && <p className="text-sm text-gray-500">🚛 {log.truckId}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!trackingData && !isLoading && !error && (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                    <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p>Enter a booking ID to track</p>
                </div>
            )}
        </div>
    );
}
