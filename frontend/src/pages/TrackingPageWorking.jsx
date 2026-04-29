import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { MapPin, Clock, AlertCircle, Navigation } from 'lucide-react';
import { format } from 'date-fns';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
    width: '100%',
    height: '600px',
};

const defaultCenter = {
    lat: 20.5937,
    lng: 78.9629,
};

const statusColors = {
    PENDING: '#94a3b8',
    PICKED_UP: '#3b82f6',
    IN_TRANSIT: '#f59e0b',
    DELIVERED: '#10b981',
    CANCELLED: '#ef4444',
};

export default function TrackingPageWorking() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookingId, setBookingId] = useState(searchParams.get('bookingId') || '');
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [map, setMap] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    });

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

    // Fit bounds when data loads
    useEffect(() => {
        if (map && trackingData?.trackingLogs?.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            trackingData.trackingLogs.forEach(log => {
                bounds.extend({ lat: log.latitude, lng: log.longitude });
            });

            // Fit to bounds with padding
            map.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 });

            // Force a re-render after bounds are set
            setTimeout(() => {
                map.panToBounds(bounds);
            }, 500);
        }
    }, [map, trackingData]);

    const pathCoordinates = trackingData?.trackingLogs?.map(log => ({
        lat: log.latitude,
        lng: log.longitude,
    })) || [];

    if (!isLoaded) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Loading Google Maps...</p>
                </div>
            </div>
        );
    }

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
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={defaultCenter}
                            zoom={6}
                            onLoad={setMap}
                            options={{
                                streetViewControl: false,
                                mapTypeControl: true,
                                fullscreenControl: true,
                            }}
                        >
                            {/* Route line */}
                            {pathCoordinates.length > 1 && (
                                <Polyline
                                    path={pathCoordinates}
                                    options={{
                                        strokeColor: '#3b82f6',
                                        strokeOpacity: 0.8,
                                        strokeWeight: 4,
                                    }}
                                />
                            )}

                            {/* Regular markers for all points */}
                            {trackingData.trackingLogs?.map((log, index) => {
                                const isFirst = index === 0;
                                const isLast = index === trackingData.trackingLogs.length - 1;

                                return (
                                    <Marker
                                        key={log.id}
                                        position={{ lat: log.latitude, lng: log.longitude }}
                                        onClick={() => setSelectedMarker(log)}
                                        label={{
                                            text: String(index + 1),
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                        }}
                                        icon={{
                                            path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                                            fillColor: isLast ? '#f59e0b' : isFirst ? '#3b82f6' : '#94a3b8',
                                            fillOpacity: 1,
                                            strokeColor: '#ffffff',
                                            strokeWeight: 2,
                                            scale: isLast ? 1.5 : 1,
                                        }}
                                    />
                                );
                            })}

                            {/* Info window */}
                            {selectedMarker && (
                                <InfoWindow
                                    position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
                                    onCloseClick={() => setSelectedMarker(null)}
                                >
                                    <div className="p-2">
                                        <div className="font-semibold mb-2 text-lg">
                                            {selectedMarker.status.replace('_', ' ')}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-1">
                                            <Clock className="w-3 h-3 inline mr-1" />
                                            {format(new Date(selectedMarker.timestamp), 'MMM dd, yyyy HH:mm')}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {selectedMarker.latitude.toFixed(6)}, {selectedMarker.longitude.toFixed(6)}
                                        </p>
                                        {selectedMarker.truckId && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                🚛 Truck: {selectedMarker.truckId}
                                            </p>
                                        )}
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
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
