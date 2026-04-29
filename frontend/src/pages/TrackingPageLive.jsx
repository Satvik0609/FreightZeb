import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { MapPin, Clock, AlertCircle, Navigation, Truck as TruckIcon } from 'lucide-react';
import { format } from 'date-fns';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const statusColors = {
    PENDING: '#94a3b8',
    PICKED_UP: '#3b82f6',
    IN_TRANSIT: '#f59e0b',
    DELIVERED: '#10b981',
    CANCELLED: '#ef4444',
};

export default function TrackingPageLive() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookingId, setBookingId] = useState(searchParams.get('bookingId') || '');
    const [map, setMap] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [polyline, setPolyline] = useState(null);
    const [truckMarker, setTruckMarker] = useState(null);

    const { data: trackingData, isLoading, error, refetch } = useQuery({
        queryKey: ['tracking', bookingId],
        queryFn: async () => {
            if (!bookingId) return null;
            const res = await api.get(`/tracking/${bookingId}/history`);
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

    // Initialize Google Map
    useEffect(() => {
        if (!window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
            script.async = true;
            script.defer = true;
            script.onload = initMap;
            document.head.appendChild(script);
        } else {
            initMap();
        }

        function initMap() {
            const mapInstance = new window.google.maps.Map(document.getElementById('map'), {
                center: { lat: 20.5937, lng: 78.9629 }, // Center of India
                zoom: 5,
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true,
            });
            setMap(mapInstance);
        }
    }, []);

    // Update markers when tracking data changes
    useEffect(() => {
        if (!map || !trackingData?.trackingLogs?.length) return;

        // Clear existing markers
        markers.forEach(m => m.setMap(null));
        if (polyline) polyline.setMap(null);
        if (truckMarker) truckMarker.setMap(null);

        const logs = trackingData.trackingLogs;
        const bounds = new window.google.maps.LatLngBounds();

        // Create path for polyline
        const path = logs.map(log => ({
            lat: log.latitude,
            lng: log.longitude,
        }));

        // Draw route line
        const line = new window.google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map,
        });
        setPolyline(line);

        // Add markers for each point
        const newMarkers = logs.map((log, index) => {
            const isFirst = index === 0;
            const isLast = index === logs.length - 1;

            const marker = new window.google.maps.Marker({
                position: { lat: log.latitude, lng: log.longitude },
                map: map,
                label: {
                    text: String(index + 1),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                },
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: isFirst || isLast ? 10 : 7,
                    fillColor: isLast ? '#10b981' : isFirst ? '#3b82f6' : statusColors[log.status] || '#94a3b8',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
                title: `${log.status} - ${format(new Date(log.timestamp), 'MMM dd, HH:mm')}`,
            });

            bounds.extend({ lat: log.latitude, lng: log.longitude });
            return marker;
        });

        setMarkers(newMarkers);

        // Add animated truck marker at latest position
        const latest = logs[logs.length - 1];
        const truck = new window.google.maps.Marker({
            position: { lat: latest.latitude, lng: latest.longitude },
            map: map,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        `),
                scaledSize: new window.google.maps.Size(48, 48),
                anchor: new window.google.maps.Point(24, 24),
            },
            title: 'Current Location',
            animation: window.google.maps.Animation.BOUNCE,
            zIndex: 1000,
        });

        setTruckMarker(truck);

        // Fit map to show all markers
        map.fitBounds(bounds);

        // Add some padding
        const padding = { top: 50, right: 50, bottom: 50, left: 50 };
        map.fitBounds(bounds, padding);

    }, [map, trackingData]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">🚛 Live Tracking</h1>
                <p className="text-gray-600">Real-time shipment tracking with live location</p>
            </div>

            <form onSubmit={handleSearch} className="mb-6">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                        placeholder="Enter Booking ID"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Track
                    </button>
                </div>
            </form>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-red-900">Error</h3>
                        <p className="text-red-700 text-sm mt-1">{error.message}</p>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Loading tracking data...</p>
                </div>
            )}

            {trackingData && !isLoading && (
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Booking: {trackingData.bookingId}</h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span
                                        className="px-3 py-1 rounded-full text-sm font-medium text-white"
                                        style={{ backgroundColor: statusColors[trackingData.status] }}
                                    >
                                        {trackingData.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-gray-500 text-sm">
                                        {trackingData.trackingLogs?.length || 0} location updates
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => refetch()}
                                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Navigation className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Map */}
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div id="map" style={{ width: '100%', height: '600px' }}></div>
                    </div>

                    {/* Current Location Card */}
                    {trackingData.trackingLogs?.length > 0 && (
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg shadow-md p-6 border-2 border-orange-300">
                            <div className="flex items-start gap-4">
                                <div className="bg-orange-500 p-3 rounded-full">
                                    <TruckIcon className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">🚛 Current Location</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-600">Status</p>
                                            <p className="font-semibold text-gray-900">
                                                {trackingData.trackingLogs[trackingData.trackingLogs.length - 1].status.replace('_', ' ')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Last Updated</p>
                                            <p className="font-semibold text-gray-900">
                                                {format(new Date(trackingData.trackingLogs[trackingData.trackingLogs.length - 1].timestamp), 'MMM dd, HH:mm')}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-sm text-gray-600">Coordinates</p>
                                            <p className="font-mono text-sm text-gray-900">
                                                {trackingData.trackingLogs[trackingData.trackingLogs.length - 1].latitude.toFixed(6)}, {trackingData.trackingLogs[trackingData.trackingLogs.length - 1].longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Journey Timeline</h3>
                        <div className="space-y-4">
                            {trackingData.trackingLogs?.slice().reverse().map((log, index) => (
                                <div key={log.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                                            style={{ backgroundColor: statusColors[log.status] }}
                                        >
                                            {trackingData.trackingLogs.length - index}
                                        </div>
                                        {index < trackingData.trackingLogs.length - 1 && (
                                            <div className="w-0.5 h-full bg-gray-300 my-1"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-semibold text-gray-900">{log.status.replace('_', ' ')}</h4>
                                            <span className="text-sm text-gray-500">
                                                {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            📍 {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                                        </p>
                                        {log.truckId && (
                                            <p className="text-sm text-gray-500 mt-1">🚛 Truck: {log.truckId}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!trackingData && !isLoading && !error && (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                    <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tracking Data</h3>
                    <p className="text-gray-600">Enter a booking ID above to track your shipment</p>
                </div>
            )}
        </div>
    );
}
