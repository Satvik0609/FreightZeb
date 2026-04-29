import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapPin, Truck, Activity, Clock, Navigation, AlertCircle,
  CheckCircle2, ArrowRight, Gauge, Timer,
} from 'lucide-react'
import { useJsApiLoader, GoogleMap, Polyline, Marker, InfoWindow } from '@react-google-maps/api'
import { bookingsService }  from '@/services/bookings.service'
import { trackingService }  from '@/services/tracking.service'
import { useAuthStore }     from '@/store/authStore'
import { getSocket }        from '@/lib/socket'
import Card                 from '@/components/ui/Card'
import StatusBadge          from '@/components/shared/StatusBadge'
import { SkeletonCard }     from '@/components/ui/Skeleton'
import { formatRelative }   from '@/utils/formatters'
import PageHeader           from '@/components/layout/PageHeader'
import { normalizeBooking, normalizeTrackingLog } from '@/utils/normalizers'

// ── Google Maps configuration ─────────────────────────────────────────────────
const MAPS_LIBRARIES = ['geometry']
const MAP_DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // India center
const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [],
}

// ── Route polyline styles ─────────────────────────────────────────────────────
const ROUTE_OPTIONS = {
  strokeColor:   '#2563eb',
  strokeWeight:  5,
  strokeOpacity: 0.8,
}
const FALLBACK_POLYLINE_OPTIONS = {
  strokeColor:   '#6366f1',
  strokeWeight:  3,
  strokeOpacity: 0.7,
  icons: [
    {
      icon:   { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
      offset: '0',
      repeat: '16px',
    },
  ],
}

// ── Map marker SVG helpers ────────────────────────────────────────────────────
function pinSVG(color) {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
    scale: 1.8,
    anchor: { x: 12, y: 24 },
  }
}

const TRUCK_ICON = {
  path: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm13 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  fillColor:   '#2563eb',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 1,
  scale:  1.2,
  anchor: { x: 12, y: 12 },
}

// ── Route progress utilities ──────────────────────────────────────────────────

/** Find the index of the closest point in routePath to (lat, lng). */
function nearestPointIdx(routePath, lat, lng) {
  if (!routePath?.length) return -1
  let minDist = Infinity
  let idx = 0
  routePath.forEach(([rlat, rlng], i) => {
    const d = Math.hypot(rlat - lat, rlng - lng)
    if (d < minDist) { minDist = d; idx = i }
  })
  return idx
}

/**
 * Returns progress (0–1), remaining distance (km) and remaining ETA (min)
 * based on how far the truck has traveled along the route.
 */
function computeProgress(routePath, truckLat, truckLng, distanceKm, durationMin) {
  if (!routePath?.length || !distanceKm || !durationMin) return null
  const idx          = nearestPointIdx(routePath, truckLat, truckLng)
  const progress     = idx / Math.max(routePath.length - 1, 1)
  const remainingKm  = Math.max(distanceKm  * (1 - progress), 0)
  const remainingMin = Math.max(durationMin * (1 - progress), 0)
  return { progress, remainingKm, remainingMin }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NoApiKeyBanner() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
      <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Google Maps API Key Required</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
        Live Tracking uses Google Maps. Add your key to start:
      </p>
      <div className="text-left bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-xs font-mono w-full max-w-lg space-y-1">
        <p className="text-green-600 dark:text-green-400"># 1. frontend/.env</p>
        <p>VITE_GOOGLE_MAPS_API_KEY=AIza...</p>
        <p className="text-green-600 dark:text-green-400 mt-2"># 2. backend/.env</p>
        <p>GOOGLE_MAPS_API_KEY=AIza...</p>
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Enable <strong>Maps JavaScript API</strong> (frontend) and <strong>Directions API</strong> (backend) in your{' '}
        <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline text-blue-500">
          Google Cloud Console
        </a>
        .
      </p>
    </div>
  )
}

function ProgressBar({ value, className = '' }) {
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 ${className}`}>
      <div
        className="bg-blue-500 h-2 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value * 100, 100).toFixed(1)}%` }}
      />
    </div>
  )
}

function RouteInfoBar({ routeInfo, progress, truckPos }) {
  if (!routeInfo) return null
  const prog = progress && truckPos
    ? computeProgress(routeInfo.routePath, truckPos.lat, truckPos.lng, routeInfo.distanceKm, routeInfo.durationMin)
    : null

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        {/* Route total */}
        <div className="flex items-center gap-1.5 text-sm">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-white">{routeInfo.distanceText}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-600 dark:text-gray-400">{routeInfo.durationText} (no traffic)</span>
        </div>

        {/* Addresses */}
        {routeInfo.startAddress && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="truncate">{routeInfo.startAddress}</span>
          </div>
        )}
        {routeInfo.endAddress && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="truncate">{routeInfo.endAddress}</span>
          </div>
        )}

        {/* Live progress */}
        {prog && (
          <div className="ml-auto flex items-center gap-3 min-w-[200px]">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{(prog.progress * 100).toFixed(0)}% complete</span>
                <span>{prog.remainingKm.toFixed(1)} km left</span>
              </div>
              <ProgressBar value={prog.progress} />
            </div>
            <div className="flex items-center gap-1 text-xs whitespace-nowrap">
              <Timer className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-medium text-gray-800 dark:text-white">
                ~{Math.round(prog.remainingMin)} min
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const { user, token } = useAuthStore()
  const [selectedBooking, setSelectedBooking]   = useState(null)
  const [truckPositions, setTruckPositions]     = useState({})
  const [routeInfo, setRouteInfo]               = useState(null)      // from backend Directions API
  const [routeError, setRouteError]             = useState(null)      // non-fatal; shows fallback
  const [selectedMarker, setSelectedMarker]     = useState(null)      // for InfoWindow
  const mapRef = useRef(null)

  const FRONTEND_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  const hasKey = !!FRONTEND_MAPS_KEY && FRONTEND_MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY'

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: FRONTEND_MAPS_KEY,
    libraries: MAPS_LIBRARIES,
    preventGoogleFontsLoading: true,
  })

  // ── Bookings list ────────────────────────────────────────────────────────
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['bookings', user?.role, 'tracking'],
    queryFn: () => {
      if (user?.role === 'ADMIN')  return bookingsService.getAll()
      if (user?.role === 'DEALER') return bookingsService.getDealer()
      return bookingsService.getMy()
    },
    staleTime: 30 * 1000,
  })

  const activeBookings = useMemo(() => (
    (bookingsData?.bookings || bookingsData?.data || [])
      .map(normalizeBooking)
      .filter((b) => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'APPROVED'].includes(b.status))
  ), [bookingsData])

  // ── GPS history for the selected booking ────────────────────────────────
  const { data: trackingData } = useQuery({
    queryKey: ['tracking', selectedBooking?.id],
    queryFn:  () => trackingService.getHistory(selectedBooking.id),
    enabled:  !!selectedBooking,
    staleTime: 30 * 1000,
  })

  const trackingHistory = useMemo(() => (
    (trackingData?.trackingLogs || trackingData?.tracking || trackingData?.data || [])
      .map(normalizeTrackingLog)
  ), [trackingData])

  // GPS history polyline path (for fallback rendering)
  const gpsFallbackPath = useMemo(() => (
    trackingHistory.map((t) => ({ lat: t.lat, lng: t.lng })).filter((p) => p.lat && p.lng)
  ), [trackingHistory])

  const latestGpsPoint = trackingHistory[trackingHistory.length - 1]

  // ── Fetch driving directions when selected booking changes ───────────────
  // (cost-control: only called once per booking selection, not on every GPS update)
  useEffect(() => {
    if (!selectedBooking) { setRouteInfo(null); setRouteError(null); return }

    const shipment = selectedBooking.shipment
    const origin = shipment?.pickupLocation || shipment?.pickup_location
    const dest   = shipment?.destinationLocation || shipment?.destination_location

    const oLat = Number(origin?.lat ?? origin?.latitude)
    const oLng = Number(origin?.lng ?? origin?.longitude ?? origin?.lon)
    const dLat = Number(dest?.lat ?? dest?.latitude)
    const dLng = Number(dest?.lng ?? dest?.longitude ?? dest?.lon)

    if (!oLat || !oLng || !dLat || !dLng) {
      setRouteInfo(null)
      setRouteError('Route coordinates are not available for this shipment.')
      return
    }

    setRouteInfo(null)
    setRouteError(null)

    trackingService.getDirections(oLat, oLng, dLat, dLng)
      .then((res) => {
        const d = res.data
        if (d?.success && d.routePath?.length) {
          setRouteInfo(d)
          // Pan map to show the full route
          if (mapRef.current && window.google) {
            const bounds = new window.google.maps.LatLngBounds()
            d.routePath.forEach(([la, ln]) => bounds.extend({ lat: la, lng: ln }))
            mapRef.current.fitBounds(bounds, 60)
          }
        } else {
          setRouteError(d?.message || 'Could not fetch route from server.')
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err.message || 'Directions unavailable.'
        setRouteError(msg)
      })
  }, [selectedBooking?.id])   // ← only re-runs when booking changes (cost control)

  // ── Socket: real-time truck location updates ─────────────────────────────
  useEffect(() => {
    const socket = getSocket(token)
    if (!socket.connected) socket.connect()

    const onTruckLoc = ({ truckId, lat, lng, location }) => {
      setTruckPositions((prev) => ({
        ...prev,
        [truckId]: { lat: lat ?? location?.lat, lng: lng ?? location?.lng, timestamp: new Date() },
      }))
    }
    const onTrackingUpdate = ({ truckId, latitude, longitude, timestamp }) => {
      setTruckPositions((prev) => ({
        ...prev,
        [truckId]: { lat: latitude, lng: longitude, timestamp },
      }))
    }

    socket.on('truck:location',   onTruckLoc)
    socket.on('tracking:update',  onTrackingUpdate)
    return () => { socket.off('truck:location', onTruckLoc); socket.off('tracking:update', onTrackingUpdate) }
  }, [token])

  // Join socket rooms for selected booking
  useEffect(() => {
    if (selectedBooking?.truck?.id) {
      const socket = getSocket(token)
      socket.emit('join', `truck:${selectedBooking.truck.id}`)
      socket.emit('join', `booking:${selectedBooking.id}`)
    }
  }, [selectedBooking, token])

  // Auto-pan when truck moves
  const selectedTruckPos = selectedBooking?.truck?.id
    ? truckPositions[selectedBooking.truck.id]
    : null

  const onMapLoad = useCallback((map) => { mapRef.current = map }, [])

  // ── Route polyline path for Google Maps ─────────────────────────────────
  const routePathGM = useMemo(
    () => routeInfo?.routePath?.map(([la, ln]) => ({ lat: la, lng: ln })) ?? [],
    [routeInfo]
  )

  // ── Origin / Destination markers from shipment coords ───────────────────
  const originCoords = useMemo(() => {
    const s = selectedBooking?.shipment
    const o = s?.pickupLocation || s?.pickup_location
    if (!o) return null
    const la = Number(o?.lat ?? o?.latitude)
    const ln = Number(o?.lng ?? o?.longitude ?? o?.lon)
    return (la && ln) ? { lat: la, lng: ln } : null
  }, [selectedBooking])

  const destCoords = useMemo(() => {
    const s = selectedBooking?.shipment
    const d = s?.destinationLocation || s?.destination_location
    if (!d) return null
    const la = Number(d?.lat ?? d?.latitude)
    const ln = Number(d?.lng ?? d?.longitude ?? d?.lon)
    return (la && ln) ? { lat: la, lng: ln } : null
  }, [selectedBooking])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Live Tracking"
        subtitle="Real-time GPS tracking with Google Maps driving directions"
      />

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">
        {/* ── Left panel: booking list ── */}
        <div className="w-80 shrink-0 overflow-y-auto space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <SkeletonCard key={i} className="p-4" />)
          ) : activeBookings.length === 0 ? (
            <Card className="text-center py-8">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No active deliveries</p>
              <p className="text-xs text-gray-300 mt-1">Assigned, In-Transit and Picked-Up bookings appear here</p>
            </Card>
          ) : (
            activeBookings.map((b) => {
              const livePos = truckPositions[b.truck?.id]
              const isSelected = selectedBooking?.id === b.id
              return (
                <Card
                  key={b.id}
                  hover
                  padding={false}
                  onClick={() => setSelectedBooking(b)}
                  className={`p-4 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {b.truck?.registrationNumber || 'No truck'}
                      </span>
                    </div>
                    <StatusBadge status={b.status} size="sm" />
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {b.shipment?.origin} <ArrowRight className="w-3 h-3 inline" /> {b.shipment?.destinationLabel}
                    </span>
                  </div>

                  {livePos && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span>Live · {livePos.lat?.toFixed(4)}, {livePos.lng?.toFixed(4)}</span>
                      <span className="ml-auto text-gray-400">{formatRelative(livePos.timestamp)}</span>
                    </div>
                  )}

                  {isSelected && routeInfo && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <Navigation className="w-3 h-3" />
                      <span>{routeInfo.distanceText} · {routeInfo.durationText}</span>
                    </div>
                  )}

                  {isSelected && routeError && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>Route unavailable — showing GPS trail</span>
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>

        {/* ── Map area ── */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          {!hasKey ? (
            <NoApiKeyBanner />
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-center p-8">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="font-semibold text-gray-800 dark:text-white">Failed to load Google Maps</p>
              <p className="text-sm text-gray-500 mt-1">{loadError.message}</p>
            </div>
          ) : !isLoaded ? (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading Google Maps…</p>
              </div>
            </div>
          ) : (
            <>
              <GoogleMap
                mapContainerClassName="w-full h-full"
                center={MAP_DEFAULT_CENTER}
                zoom={5}
                options={MAP_OPTIONS}
                onLoad={onMapLoad}
              >
                {/* ── Road-aligned route polyline (from Google Directions API) ── */}
                {routePathGM.length > 0 && (
                  <Polyline path={routePathGM} options={ROUTE_OPTIONS} />
                )}

                {/* ── Fallback: GPS history polyline when Directions API fails ── */}
                {routePathGM.length === 0 && gpsFallbackPath.length > 1 && (
                  <Polyline path={gpsFallbackPath} options={FALLBACK_POLYLINE_OPTIONS} />
                )}

                {/* ── Origin marker ── */}
                {originCoords && (
                  <Marker
                    position={originCoords}
                    icon={pinSVG('#10b981')}
                    title={`Pickup: ${selectedBooking?.shipment?.origin || ''}`}
                    onClick={() => setSelectedMarker({ type: 'origin', pos: originCoords })}
                  />
                )}

                {/* ── Destination marker ── */}
                {destCoords && (
                  <Marker
                    position={destCoords}
                    icon={pinSVG('#ef4444')}
                    title={`Destination: ${selectedBooking?.shipment?.destinationLabel || ''}`}
                    onClick={() => setSelectedMarker({ type: 'dest', pos: destCoords })}
                  />
                )}

                {/* ── Fallback origin from GPS history ── */}
                {!originCoords && gpsFallbackPath.length > 0 && (
                  <Marker
                    position={gpsFallbackPath[0]}
                    icon={pinSVG('#10b981')}
                    title="First GPS point (pickup)"
                  />
                )}

                {/* ── Live truck markers (from socket) ── */}
                {Object.entries(truckPositions).map(([truckId, pos]) => {
                  const booking = activeBookings.find((b) => b.truck?.id === truckId)
                  const truckLatLng = { lat: pos.lat, lng: pos.lng }
                  return (
                    <Marker
                      key={truckId}
                      position={truckLatLng}
                      icon={TRUCK_ICON}
                      title={`Truck: ${booking?.truck?.registrationNumber || truckId}`}
                      onClick={() => setSelectedMarker({ type: 'truck', truckId, pos, booking })}
                      zIndex={10}
                    />
                  )
                })}

                {/* ── InfoWindows ── */}
                {selectedMarker?.type === 'origin' && (
                  <InfoWindow position={selectedMarker.pos} onCloseClick={() => setSelectedMarker(null)}>
                    <div className="text-sm font-semibold text-green-700">
                      Pickup Point<br />
                      <span className="font-normal text-gray-600 text-xs">{selectedBooking?.shipment?.origin}</span>
                    </div>
                  </InfoWindow>
                )}
                {selectedMarker?.type === 'dest' && (
                  <InfoWindow position={selectedMarker.pos} onCloseClick={() => setSelectedMarker(null)}>
                    <div className="text-sm font-semibold text-red-700">
                      Destination<br />
                      <span className="font-normal text-gray-600 text-xs">{selectedBooking?.shipment?.destinationLabel}</span>
                    </div>
                  </InfoWindow>
                )}
                {selectedMarker?.type === 'truck' && (
                  <InfoWindow
                    position={{ lat: selectedMarker.pos.lat, lng: selectedMarker.pos.lng }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="min-w-[160px]">
                      <p className="text-sm font-bold text-gray-900">
                        {selectedMarker.booking?.truck?.registrationNumber || selectedMarker.truckId}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedMarker.booking?.shipment?.origin} → {selectedMarker.booking?.shipment?.destinationLabel}
                      </p>
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                        Live position
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {selectedMarker.pos.lat?.toFixed(5)}, {selectedMarker.pos.lng?.toFixed(5)}
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>

              {/* ── Route info + progress bar overlay ── */}
              <RouteInfoBar
                routeInfo={routeInfo}
                progress={!!selectedTruckPos}
                truckPos={selectedTruckPos}
              />

              {/* ── Fetching route indicator ── */}
              {selectedBooking && !routeInfo && !routeError && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Fetching road directions…
                </div>
              )}

              {/* ── Route fallback notice ── */}
              {routeError && gpsFallbackPath.length > 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Google Directions unavailable — showing GPS trail
                </div>
              )}

              {/* ── No tracking data placeholder ── */}
              {!selectedBooking && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl p-6 text-center shadow-xl border border-gray-200 dark:border-gray-700">
                    <MapPin className="w-10 h-10 text-blue-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-700 dark:text-gray-200">Select a booking</p>
                    <p className="text-xs text-gray-400 mt-1">Choose an active delivery from the left panel<br/>to view its driving route on the map</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
