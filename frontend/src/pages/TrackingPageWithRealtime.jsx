import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { socket } from '../lib/socket';
import { MapPin, Navigation, Clock, Package, Truck, AlertCircle, Radio } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
    width: '100%',
    height: '600px',
};

const defaultCenter = {
    lat: 28.6139, // Delhi, India
    lng: 77.2090,
};

const statusColors = {
    PENDING: '#94a3b8',
    PICKED_UP: '#3b82f6',
    IN_TRANSIT: '#f59e0b',
    DELIVERED: '#10b981',
    CANCELLED: '#ef4444',
};

export default function TrackingPageWithRealtime() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookingId, setBookingId] = useState(searchParams.get('bookingId') || '');
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [mapZoom, setMapZoom] = useState(6);
    const [isConnected, setIsConnected] = useState(false);
    const [realtimeUpdates, setRealtimeUpdates] = useState([]);

    const { data: trackingData, isLoading, error, refetch } = useQuery({
        queryKey: ['tracking', bookingId],
        queryFn: async () => {
            if (!bookingId) return null;
            const res = await api.get(`/tracking/${bookingId}/history`);
            return res.data;
        },
        enabled: !!bookingId,
        refetchInterval: 30000, // Refetch every 30 seconds as fallback
    });

    // Socket.IO real-time connection
    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            console.log('Socket connected');
        }

        function onDisconnect() {
            setIsConnected(false);
            console.log('Socket disconnected');
        }

        function onTrackingUpdate(data) {
            console.log('Tracking update received:', data);

            // Add to realtime updates
            setRealtimeUpdates(prev => [...prev, {
                id: `realtime-${Date.now()}`,
                latitude: data.latitude,
                longitude: data.longitude,
                status: data.status,
                timestamp: data.timestamp,
                truckId: data.truckId,
                isRealtime: true,
            }]);

            // Show toast notification
            toast.success('Location updated in real-time!', {
                icon: '📍',
                duration: 3000,
            });

            // Update map center to new location
            setMapCenter({ lat: data.latitude, lng: data.longitude });

            // Refetch to get complete data
            refetch();
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('tracking:update', onTrackingUpdate);

        // Join booking room when bookingId changes
        if (bookingId) {
            socket.emit('join', `booking:${bookingId}`);
            console.log(`Joined room: booking:${bookingId}`);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('tracking:update', onTrackingUpdate);

            // Leave booking room
            if (bookingId) {
                socket.emit('leave', `booking:${bookingId}`);
            }
        };
    }, [bookingId, refetch]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (bookingId.trim()) {
            setSearchParams({ bookingId: bookingId.trim() });
            setRealtimeUpdates([]); // Clear realtime updates when searching new booking
            refetch();
        }
    };

    // Center map on latest location when data loads
    useEffect(() => {
        if (trackingData?.trackingLogs?.length > 0) {
            const latest = trackingData.trackingLogs[trackingData.trackingLogs.length - 1];
            setMapCenter({ lat: latest.latitude, lng: latest.longitude });
            setMapZoom(12);
        }
    }, [trackingData]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'PICKED_UP':
                return <Package className="w-4 h-4" />;
            case 'IN_TRANSIT':
                return <Truck className="w-4 h-4" />;
            case 'DELIVERED':
                return <MapPin className="w-4 h-4" />;
            default:
                return <Navigation className="w-4 h-4" />;
        }
    };

    // Combine tracking logs with realtime updates
    const allLogs = [
        ...(trackingData?.trackingLogs || []),
        ...realtimeUpdates,
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const pathCoordinates = allLogs.map(log => ({
        lat: log.latitude,
        lng: log.longitude,
    }));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Shipment</h1>
                        <p className="text-gray-600">Real-time tracking of your freight shipments</p>
                    </div>

                    {/* Connection Status */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                        <Radio className={`w-4 h-4 ${isConnected ? 'animate-pulse' : ''}`} />
                        <span className="text-sm font-medium">
                            {isConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="mb-6">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                        placeholder="Enter Booking ID (e.g., BK-001)"
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

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-red-900">Error Loading Tracking Data</h3>
                        <p className="text-red-700 text-sm mt-1">{error.message}</p>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Loading tracking information...</p>
                </div>
            )}

            {/* Tracking Data */}
            {trackingData && !isLoading && (
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between mb-4">
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
                                        {allLogs.length} location updates
                                    </span>
                                    {realtimeUpdates.length > 0 && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                            +{realtimeUpdates.length} live
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => refetch()}
                                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Map */}
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={mapCenter}
                                zoom={mapZoom}
                                options={{
                                    streetViewControl: false,
                                    mapTypeControl: true,
                                }}
                            >
                                {/* Path Line */}
                                {pathCoordinates.length > 1 && (
                                    <Polyline
                                        path={pathCoordinates}
                                        options={{
                                            strokeColor: '#3b82f6',
                                            strokeOpacity: 0.8,
                                            strokeWeight: 3,
                                        }}
                                    />
                                )}

                                {/* Markers */}
                                {allLogs.map((log, index) => {
                                    const isLatest = index === allLogs.length - 1;
                                    const isFirst = index === 0;
                                    const isRealtime = log.isRealtime;

                                    return (
                                        <Marker
                                            key={log.id}
                                            position={{ lat: log.latitude, lng: log.longitude }}
                                            onClick={() => setSelectedMarker(log)}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: isLatest ? 12 : isFirst ? 10 : 6,
                                                fillColor: isRealtime ? '#10b981' : isLatest ? '#10b981' : isFirst ? '#3b82f6' : statusColors[log.status],
                                                fillOpacity: 1,
                                                strokeColor: isRealtime ? '#059669' : '#ffffff',
                                                strokeWeight: isRealtime ? 3 : 2,
                                            }}
                                            animation={isRealtime ? window.google.maps.Animation.BOUNCE : null}
                                        />
                                    );
                                })}

                                {/* Info Window */}
                                {selectedMarker && (
                                    <InfoWindow
                                        position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
                                        onCloseClick={() => setSelectedMarker(null)}
                                    >
                                        <div className="p-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                {getStatusIcon(selectedMarker.status)}
                                                <span className="font-semibold">{selectedMarker.status.replace('_', ' ')}</span>
                                                {selectedMarker.isRealtime && (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                        LIVE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-1">
                                                <Clock className="w-3 h-3 inline mr-1" />
                                                {format(new Date(selectedMarker.timestamp), 'MMM dd, yyyy HH:mm')}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Lat: {selectedMarker.latitude.toFixed(6)}, Lng: {selectedMarker.longitude.toFixed(6)}
                                            </p>
                                            {selectedMarker.truckId && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    <Truck className="w-3 h-3 inline mr-1" />
                                                    Truck: {selectedMarker.truckId}
                                                </p>
                                            )}
                                        </div>
                                    </InfoWindow>
                                )}
                            </GoogleMap>
                        </LoadScript>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tracking History</h3>
                        <div className="space-y-4">
                            {allLogs.slice().reverse().map((log, index) => (
                                <div key={log.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${log.isRealtime ? 'ring-2 ring-green-400 ring-offset-2' : ''
                                                }`}
                                            style={{ backgroundColor: statusColors[log.status] }}
                                        >
                                            {getStatusIcon(log.status)}
                                        </div>
                                        {index < allLogs.length - 1 && (
                                            <div className="w-0.5 h-full bg-gray-300 my-1"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-900">{log.status.replace('_', ' ')}</h4>
                                                {log.isRealtime && (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                        LIVE UPDATE
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-gray-500">
                                                {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Location: {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                                        </p>
                                        {log.truckId && (
                                            <p className="text-sm text-gray-500 mt-1">Truck ID: {log.truckId}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
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
