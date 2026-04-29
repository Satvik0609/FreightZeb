import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { MapPin, Navigation, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LocationPusher({ bookingId, onLocationPushed }) {
    const [pushing, setPushing] = useState(false);
    const [autoTrack, setAutoTrack] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(null);

    useEffect(() => {
        let watchId;

        if (autoTrack && 'geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    setCurrentPosition({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    toast.error('Unable to get your location');
                    setAutoTrack(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                }
            );
        }

        return () => {
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [autoTrack]);

    const pushCurrentLocation = async (status = 'IN_TRANSIT') => {
        if (!currentPosition) {
            toast.error('Location not available');
            return;
        }

        setPushing(true);
        try {
            await api.post('/tracking/push', {
                bookingId,
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude,
                status,
            });
            toast.success('Location updated successfully');
            onLocationPushed?.();
        } catch (error) {
            toast.error(error.message || 'Failed to update location');
        } finally {
            setPushing(false);
        }
    };

    const getCurrentLocation = () => {
        if (!('geolocation' in navigator)) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCurrentPosition({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                toast.success('Location acquired');
            },
            (error) => {
                console.error('Geolocation error:', error);
                toast.error('Unable to get your location');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0,
            }
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Location</h3>

            <div className="space-y-4">
                {/* Current Position Display */}
                {currentPosition && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm font-medium">Current Location</span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                            Lat: {currentPosition.latitude.toFixed(6)}, Lng: {currentPosition.longitude.toFixed(6)}
                        </p>
                    </div>
                )}

                {/* Auto-track Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={autoTrack}
                        onChange={(e) => setAutoTrack(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Auto-track my location</span>
                </label>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={getCurrentLocation}
                        disabled={autoTrack}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Navigation className="w-4 h-4" />
                        Get Location
                    </button>

                    <button
                        onClick={() => pushCurrentLocation('IN_TRANSIT')}
                        disabled={!currentPosition || pushing}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {pushing ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            <>
                                <MapPin className="w-4 h-4" />
                                Push Update
                            </>
                        )}
                    </button>
                </div>

                {/* Status Update Buttons */}
                <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-3">Update status:</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => pushCurrentLocation('PICKED_UP')}
                            disabled={!currentPosition || pushing}
                            className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            Picked Up
                        </button>
                        <button
                            onClick={() => pushCurrentLocation('IN_TRANSIT')}
                            disabled={!currentPosition || pushing}
                            className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            In Transit
                        </button>
                        <button
                            onClick={() => pushCurrentLocation('DELIVERED')}
                            disabled={!currentPosition || pushing}
                            className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm col-span-2"
                        >
                            Delivered
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
