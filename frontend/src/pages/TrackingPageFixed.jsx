import { useState, useEffect, useRef } from 'react';
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

// Truck SVG icon for marker
const TRUCK_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5">
  <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
  <path d="M16 8h4l3 3v5h-7V8z"/>
  <circle cx="5.5" cy="18.5" r="2.5" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
  <circle cx="18.5" cy="18.5" r="2.5" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
</svg>
`;

export default function TrackingPageFixed() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookingId, setBookingId] = useState(searchParams.get('bookingId') || '');
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const polylineRef = useRef(null);
    const truckMarkerRef = useRef(null);
    const [mapLoaded, setMapLoaded] = useState(false);

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

    // Load Google Maps script
    useEffect(() => {
        if (window.google?.maps) {
            setMapLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        document.head.appendChild(script);

        return () => {
            // Cleanup if needed
        };
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 20.5937, lng: 78.9629 },
            zoom: 5,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
        });
    }, [mapLoaded]);

    // Update markers when tracking data changes
    useEffect(() => {
        if (!mapInstanceRef.current || !trackingData?.trackingLogs?.length) return;

        // Clear existing markers
        markersRef.current.forEach(m => m.setMap(null));
        if (polylineRef.current) polylineRef.current.setMap(null);
        if (truckMarkerRef.current) truckMarkerRef.current.setMap(null);

        const logs = trackingData.trackingLogs;
        const bounds = new window.google.maps.LatLngBounds();

        // Create path for polyline
        const path = logs.map(log => ({
            lat: log.latitude,
            lng: log.longitude,
        }));

        // Draw route line
        polylineRef.current = new window.google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: mapInstanceRef.current,
        });

        // Add markers for each point (small circles)
        const newMarkers = logs.map((log, index) => {
            const isFirst = index === 0;
            const isLast = index === logs.length - 1;

            const marker = new window.google.maps.Marker({
                position: { lat: log.latitude, lng: log.longitude },
                map: mapInstanceRef.current,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: isFirst || isLast ? 8 : 5,
                    fillColor: isLast ? '#10b981' : isFirst ? '#3b82f6' : '#94a3b8',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
                title: `Stop ${index + 1}: ${log.status}`,
            });

            // Add info window
            const infoWindow = new window.google.maps.InfoWindow({
                content: `
          <div style="padding: 8px;">
            <strong>Stop ${index + 1}</strong><br/>
            <span style="color: #666;">${log.status.replace('_', ' ')}</span><br/>
            <span style="font-size: 12px; color: #999;">${format(new Date(log.timestamp), 'MMM dd, HH:mm')}</span>
          </div>
        `,
            });

            marker.addListener('click', () => {
                infoWindow.open(mapInstanceRef.current, marker);
            });

            bounds.extend({ lat: log.latitude, lng: log.longitude });
            return marker;
        });

        markersRef.current = newMarkers;

        // Add TRUCK marker at latest position (ON THE MAP)
        const latest = logs[logs.length - 1];

        truckMarkerRef.current = new window.google.maps.Marker({
            position: { lat: latest.latitude, lng: latest.longitude },
            map: mapInstanceRef.current,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(TRUCK_ICON),
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20),
            },
            title: '🚛 Current Location',
            animation: window.google.maps.Animation.BOUNCE,
            zIndex: 1000,
        });

        // Info window for truck
        const truckInfo = new window.google.maps.InfoWindow({
            content: `
        <div style="padding: 12px; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 24px;">🚛</span>
            <strong style="font-size: 16px;">Current Location</strong>
          </div>
          <div style="color: #666; font-size: 14px;">
            <strong>Status:</strong> ${latest.status.replace('_', ' ')}<br/>
            <strong>Updated:</strong> ${format(new Date(latest.timestamp), 'MMM dd, HH:mm')}<br/>
            <strong>Truck:</strong> ${latest.truckId || 'N/A'}
          </div>
        </div>
      `,
        });

        truckMarkerRef.current.addListener('click', () => {
            truckInfo.open(mapInstanceRef.current, truckMarkerRef.current);
        });

        // Auto-open truck info window
        setTimeout(() => {
            truckInfo.open(mapInstanceRef.current, truckMarkerRef.current);
        }, 500);

        // Fit map to show all markers
        mapInstanceRef.current.fitBounds(bounds);

        // Add padding
        const padding = { top: 80, right: 80, bottom: 80, left: 80 };
        mapInstanceRef.current.fitBounds(bounds, padding);

    }, [mapInstanceRef.current, trackingData]);

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
                        <div
                            ref={mapRef}
                            style={{ width: '100%', height: '600px' }}
                            className="bg-gray-100"
                        />
                    </div>

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
