import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Truck, Activity, Clock, Navigation, AlertCircle,
  CheckCircle2, ArrowRight, Gauge, Timer, Send, BarChart2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useJsApiLoader, GoogleMap, Polyline, Marker, InfoWindow } from '@react-google-maps/api'
import { bookingsService } from '@/services/bookings.service'
import { trackingService } from '@/services/tracking.service'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import StatusBadge from '@/components/shared/StatusBadge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatRelative } from '@/utils/formatters'
import PageHeader from '@/components/layout/PageHeader'
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

// ── Route polyline styles — one color per selected booking ───────────────────
const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2']
const FALLBACK_POLYLINE_OPTIONS = {
  strokeColor: '#6366f1',
  strokeWeight: 3,
  strokeOpacity: 0.7,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }],
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

// ── Per truck-type map icons ──────────────────────────────────────────────────
// Each uses a distinct SVG path + color so they're visually different on the map

const TRUCK_TYPE_ICONS = {
  // Small Van — compact box shape, teal
  SMALL_VAN: {
    path: 'M2 8h14v8H2zM16 10h3l2 2v4h-5v-6zM5 16a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z',
    fillColor: '#0891b2',   // cyan-600
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 1,
    scale: 1.3,
    anchor: { x: 10, y: 12 },
  },
  // 20ft Container — long truck, blue
  CONTAINER_20FT: {
    path: 'M1 5h16v10H1zM17 8h4l2 2v5h-6V8zM5 15a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm12 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
    fillColor: '#2563eb',   // blue-600
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 1,
    scale: 1.3,
    anchor: { x: 12, y: 12 },
  },
  // 32ft Container — extra long, indigo
  CONTAINER_32FT: {
    path: 'M1 5h18v10H1zM19 8h4l2 2v5h-6V8zM5 15a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm14 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
    fillColor: '#4f46e5',   // indigo-600
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 1,
    scale: 1.3,
    anchor: { x: 12, y: 12 },
  },
  // Flatbed Trailer — open bed shape, orange
  FLATBED_TRAILER: {
    path: 'M1 10h20v4H1zM21 10h3l1 2v2h-4v-4zM5 14a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm14 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
    fillColor: '#ea580c',   // orange-600
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 1,
    scale: 1.3,
    anchor: { x: 12, y: 12 },
  },
  // Reefer — refrigerated, snowflake-ish color, cyan
  REEFER: {
    path: 'M1 5h16v10H1zM17 8h4l2 2v5h-6V8zM5 15a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm12 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 7v2M12 7v2M8 13v2M12 13v2',
    fillColor: '#0e7490',   // cyan-700
    fillOpacity: 1,
    strokeColor: '#bae6fd',  // light blue stroke to suggest cold
    strokeWeight: 1.5,
    scale: 1.3,
    anchor: { x: 12, y: 12 },
  },
}

// Fallback for unknown types
const DEFAULT_TRUCK_ICON = TRUCK_TYPE_ICONS.CONTAINER_20FT

function getTruckIcon(truckType) {
  return TRUCK_TYPE_ICONS[truckType] || DEFAULT_TRUCK_ICON
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
  const idx = nearestPointIdx(routePath, truckLat, truckLng)
  const progress = idx / Math.max(routePath.length - 1, 1)
  const remainingKm = Math.max(distanceKm * (1 - progress), 0)
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
          {routeInfo.durationText && routeInfo.durationText !== '—' && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600 dark:text-gray-400">{routeInfo.durationText} (no traffic)</span>
            </>
          )}
          {routeInfo.isFallback && (
            <span className="text-xs text-amber-500 ml-1">(straight line — road route unavailable)</span>
          )}
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

// ── GPS Push Panel ────────────────────────────────────────────────────────────

function GpsPushPanel({ selectedBooking, gpsForm, setGpsForm, gpsPushing, onPush }) {
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [source, setSource] = useState('') // 'geo' | 'truck' | ''

  // Auto-fill from shipment pickup coords → truck last location → browser GPS
  useEffect(() => {
    // Priority 1: shipment pickup location (where the truck should currently be)
    const pickup = selectedBooking?.shipment?.pickupLocation
    const pickupLat = Number(pickup?.lat ?? pickup?.latitude)
    const pickupLng = Number(pickup?.lng ?? pickup?.longitude)

    if (pickupLat && pickupLng) {
      setGpsForm((f) => ({ ...f, lat: String(pickupLat.toFixed(6)), lng: String(pickupLng.toFixed(6)) }))
      setSource('pickup')
      setGeoError('')
      return
    }

    // Priority 2: truck's last known location from DB
    const loc = selectedBooking?.truck?.currentLocation
    if (loc?.lat && loc?.lng) {
      setGpsForm((f) => ({ ...f, lat: String(Number(loc.lat).toFixed(6)), lng: String(Number(loc.lng).toFixed(6)) }))
      setSource('truck')
      setGeoError('')
      return
    }

    // Priority 3: browser geolocation
    useDeviceLocation()
  }, [selectedBooking?.id])

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser')
      return
    }
    setGeoLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsForm((f) => ({
          ...f,
          lat: String(pos.coords.latitude.toFixed(6)),
          lng: String(pos.coords.longitude.toFixed(6)),
        }))
        setSource('geo')
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Location permission denied' : 'Could not get location')
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const truck = selectedBooking?.truck
  const lastLoc = truck?.currentLocation

  return (
    <Card className="p-4 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> Push GPS Location
        </p>
        <button
          onClick={useDeviceLocation}
          disabled={geoLoading}
          className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          title="Use my device location"
        >
          {geoLoading
            ? <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
            : <Navigation className="w-3 h-3" />
          }
          {geoLoading ? 'Getting...' : 'Use my location'}
        </button>
      </div>

      {/* Source badge */}
      {source && !geoError && (
        <div className={`flex items-center gap-1.5 text-[11px] mb-2 px-2 py-1 rounded-md ${source === 'geo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : source === 'pickup' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
          }`}>
          <div className="w-1.5 h-1.5 rounded-full bg-current" />
          {source === 'geo'
            ? 'Auto-filled from device GPS'
            : source === 'pickup'
              ? `Pickup: ${selectedBooking?.shipment?.pickupLocation?.city || 'origin'} (${gpsForm.lat}, ${gpsForm.lng})`
              : `Truck's last known location`}
        </div>
      )}

      {geoError && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {geoError} — enter manually
        </p>
      )}

      <div className="space-y-2">
        {/* Coordinates — read-only display + manual override */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Latitude</label>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={gpsForm.lat}
                onChange={(e) => { setGpsForm((f) => ({ ...f, lat: e.target.value })); setSource('manual') }}
                className="w-full text-sm px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="—"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={gpsForm.lng}
              onChange={(e) => { setGpsForm((f) => ({ ...f, lng: e.target.value })); setSource('manual') }}
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="—"
            />
          </div>
        </div>

        {/* Last known location shortcut */}
        {lastLoc?.lat && lastLoc?.lng && (
          <button
            onClick={() => {
              setGpsForm((f) => ({ ...f, lat: String(Number(lastLoc.lat).toFixed(6)), lng: String(Number(lastLoc.lng).toFixed(6)) }))
              setSource('truck')
            }}
            className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg border border-dashed border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <MapPin className="w-3 h-3 inline mr-1" />
            Last known: {Number(lastLoc.lat).toFixed(4)}, {Number(lastLoc.lng).toFixed(4)}
          </button>
        )}

        {/* Pickup / Destination quick-set buttons */}
        {(() => {
          const pickup = selectedBooking?.shipment?.pickupLocation
          const dest = selectedBooking?.shipment?.destination
          const pLat = Number(pickup?.lat), pLng = Number(pickup?.lng)
          const dLat = Number(dest?.lat), dLng = Number(dest?.lng)
          return (
            <div className="grid grid-cols-2 gap-1.5">
              {pLat && pLng && (
                <button
                  onClick={() => { setGpsForm((f) => ({ ...f, lat: String(pLat.toFixed(6)), lng: String(pLng.toFixed(6)) })); setSource('pickup') }}
                  className="text-[11px] px-2 py-1.5 rounded-lg border border-dashed border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
                >
                  <span className="block font-medium">📍 Pickup</span>
                  <span className="text-gray-400">{pickup?.city || `${pLat.toFixed(3)},${pLng.toFixed(3)}`}</span>
                </button>
              )}
              {dLat && dLng && (
                <button
                  onClick={() => { setGpsForm((f) => ({ ...f, lat: String(dLat.toFixed(6)), lng: String(dLng.toFixed(6)) })); setSource('dest') }}
                  className="text-[11px] px-2 py-1.5 rounded-lg border border-dashed border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <span className="block font-medium">🏁 Destination</span>
                  <span className="text-gray-400">{dest?.city || `${dLat.toFixed(3)},${dLng.toFixed(3)}`}</span>
                </button>
              )}
            </div>
          )
        })()}

        <Select
          value={gpsForm.status}
          onChange={(e) => setGpsForm((f) => ({ ...f, status: e.target.value }))}
          options={[
            { value: 'PICKED_UP', label: 'PICKED UP' },
            { value: 'IN_TRANSIT', label: 'IN TRANSIT' },
          ]}
        />

        <Button
          size="sm"
          className="w-full"
          loading={gpsPushing}
          disabled={!gpsForm.lat || !gpsForm.lng}
          onClick={onPush}
        >
          <Send className="w-3.5 h-3.5 mr-1" /> Update Location
        </Button>
        <p className="text-[10px] text-blue-500 dark:text-blue-400 text-center">
          Saves to DB · broadcasts via WebSocket to all watchers
        </p>
      </div>
    </Card>
  )
}

// ── Route Comparison Panel ────────────────────────────────────────────────────
function RouteComparisonPanel({ selectedBookings, routeInfoMap, colors, onRemove }) {
  if (selectedBookings.length < 2) return null
  return (
    <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
        <BarChart2 className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-800 dark:text-white">Route Comparison</span>
        <span className="text-xs text-gray-400 ml-1">({selectedBookings.length} routes)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-2 font-medium">Route</th>
              <th className="px-4 py-2 font-medium">Truck</th>
              <th className="px-4 py-2 font-medium">Distance</th>
              <th className="px-4 py-2 font-medium">Drive Time</th>
              <th className="px-4 py-2 font-medium">With Traffic</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Via</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {selectedBookings.map((b, i) => {
              const info = routeInfoMap[b.id]
              const color = colors[i % colors.length]
              return (
                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                      <span className="font-medium text-gray-800 dark:text-white truncate max-w-[140px]">
                        {b.shipment?.origin} → {b.shipment?.destinationLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                    {b.truck?.registrationNumber || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                    {info?.distanceText || (info ? '—' : <span className="text-gray-300 animate-pulse">…</span>)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                    {info?.durationText || (info ? '—' : '…')}
                  </td>
                  <td className="px-4 py-2.5">
                    {info?.trafficDurationText
                      ? <span className={info.trafficDelayMin > 20 ? 'text-orange-500 font-medium' : 'text-green-600 dark:text-green-400'}>
                        {info.trafficDurationText}
                        {info.trafficDelayMin > 0 && <span className="text-orange-400 ml-1">(+{info.trafficDelayMin}m)</span>}
                      </span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${b.status === 'IN_TRANSIT' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      b.status === 'PICKED_UP' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 truncate max-w-[120px]">
                    {info?.summary || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => onRemove(b.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Unified Shipment Tracking Panel (warehouse = read-only, dealer = GPS push too) ──
function ShipmentTrackingPanel({ booking, truckPos, routeInfo, latestGpsPoint, onLocate, role, gpsForm, setGpsForm, gpsPushing, onPush }) {
  const truck = booking.truck || {}
  const regNo = truck.registrationNumber || truck.registrationNo || '—'
  const truckType = (truck.truckType || '').replace(/_/g, ' ')
  const predictions = booking.shipment?.predictions || []
  const etaPred = predictions.find((p) => p.type === 'ETA_HOURS')
  const delayPred = predictions.find((p) => p.type === 'DELAY_RISK_PERCENT')
  const fuelPred = predictions.find((p) => p.type === 'FUEL_ESTIMATE_LITERS')
  const co2Pred = predictions.find((p) => p.type === 'CO2_KG')
  const origin = booking.shipment?.origin || booking.shipment?.pickupLocation?.city || '—'
  const dest = booking.shipment?.destinationLabel || booking.shipment?.destination?.city || '—'

  const lastUpdateMin = latestGpsPoint?.timestamp
    ? Math.round((Date.now() - new Date(latestGpsPoint.timestamp).getTime()) / 60000)
    : null
  const isLive = truckPos && lastUpdateMin !== null && lastUpdateMin < 5
  const isStale = lastUpdateMin !== null && lastUpdateMin >= 15

  const progress = routeInfo?.routePath?.length && truckPos
    ? computeProgress(routeInfo.routePath, truckPos.lat, truckPos.lng, routeInfo.distanceKm, routeInfo.durationMin)
    : null

  const delayVal = delayPred ? Number(delayPred.value) : null
  const delayColor = delayVal == null ? 'text-gray-400'
    : delayVal >= 70 ? 'text-red-500' : delayVal >= 45 ? 'text-orange-500'
      : delayVal >= 20 ? 'text-yellow-500' : 'text-green-500'

  const isDealer = role === 'DEALER' || role === 'CARGO_DEALER'

  return (
    <div className="space-y-3">

      {/* ── Live status header ── */}
      <Card className={`border ${isLive ? 'border-green-300 dark:border-green-700' : isStale ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : isStale ? 'bg-amber-500' : 'bg-gray-400'}`} />
            <p className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wide">
              {isLive ? 'Live' : isStale ? 'Signal Lost' : 'Tracking'}
            </p>
          </div>
          {truckPos && (
            <button onClick={onLocate} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg transition-colors">
              <Navigation className="w-3 h-3" /> Locate
            </button>
          )}
        </div>

        {/* Truck */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{regNo}</p>
            <p className="text-xs text-gray-500">{truckType}</p>
          </div>
        </div>

        {/* Route */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 p-2.5 mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate">{origin} → {dest}</p>
          </div>
          {routeInfo && !routeInfo.isFallback ? (
            <div className="space-y-0.5 text-xs text-indigo-600 dark:text-indigo-400">
              <p>📏 {routeInfo.distanceText} · ⏱ {routeInfo.durationText}</p>
              {routeInfo.trafficDurationText && (
                <p className={routeInfo.trafficDelayMin > 20 ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}>
                  🚦 {routeInfo.trafficDurationText}{routeInfo.trafficDelayMin > 0 ? ` (+${routeInfo.trafficDelayMin}m)` : ''}
                </p>
              )}
              {routeInfo.summary && <p className="text-[11px] text-indigo-400">Via {routeInfo.summary}</p>}
              {routeInfo.hasTolls && <p className="text-[11px] text-amber-500">⚠️ Toll road</p>}
              <p className="text-[10px] text-indigo-300">📍 Google Maps · live traffic</p>
            </div>
          ) : (
            <p className="text-xs text-indigo-400">Fetching route...</p>
          )}
        </div>

        {/* Live position */}
        {truckPos ? (
          <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2.5 mb-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Current Position</p>
            <p className="text-xs font-mono text-gray-700 dark:text-gray-200">{truckPos.lat?.toFixed(5)}, {truckPos.lng?.toFixed(5)}</p>
            {lastUpdateMin !== null && (
              <p className={`text-[10px] mt-0.5 ${isStale ? 'text-amber-500' : 'text-gray-400'}`}>
                {lastUpdateMin === 0 ? 'Just now' : `${lastUpdateMin}m ago`}{isStale ? ' — signal may be lost' : ''}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-2 mb-3">
            <p className="text-xs text-gray-400">Waiting for GPS signal...</p>
          </div>
        )}

        {/* Progress bar */}
        {progress && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>{(progress.progress * 100).toFixed(0)}% complete</span>
              <span>{progress.remainingKm.toFixed(0)} km · ~{Math.round(progress.remainingMin)} min left</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(progress.progress * 100, 100)}%` }} />
            </div>
          </div>
        )}

        {/* ML predictions 2×2 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" /> ETA</p>
            <p className="text-base font-bold text-gray-900 dark:text-white">{etaPred ? `${Number(etaPred.value).toFixed(1)}h` : '—'}</p>
            {etaPred?.confidence && <p className="text-[10px] text-gray-400">{Math.round(etaPred.confidence * 100)}% conf</p>}
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-orange-500" /> Delay Risk</p>
            <p className={`text-base font-bold ${delayColor}`}>{delayVal != null ? `${delayVal.toFixed(1)}%` : '—'}</p>
            {delayVal != null && <p className={`text-[10px] font-semibold ${delayColor}`}>{delayVal >= 70 ? 'CRITICAL' : delayVal >= 45 ? 'HIGH' : delayVal >= 20 ? 'MODERATE' : 'LOW'}</p>}
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 mb-0.5">⛽ Fuel</p>
            <p className="text-base font-bold text-gray-900 dark:text-white">{fuelPred ? `${Number(fuelPred.value).toFixed(1)} L` : '—'}</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 mb-0.5">🌿 CO₂</p>
            <p className="text-base font-bold text-gray-900 dark:text-white">{co2Pred ? `${Number(co2Pred.value).toFixed(1)} kg` : '—'}</p>
          </div>
        </div>
      </Card>

      {/* ── GPS Push (dealer only) ── */}
      {isDealer && (
        <GpsPushPanel
          selectedBooking={booking}
          gpsForm={gpsForm}
          setGpsForm={setGpsForm}
          gpsPushing={gpsPushing}
          onPush={onPush}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const { user, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set())
  const [truckPositions, setTruckPositions] = useState({})
  const [routeInfoMap, setRouteInfoMap] = useState({})   // bookingId → routeInfo
  const [routeErrorMap, setRouteErrorMap] = useState({}) // bookingId → error string
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [gpsForm, setGpsForm] = useState({ lat: '', lng: '', status: 'IN_TRANSIT' })
  const [gpsPushing, setGpsPushing] = useState(false)
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
      if (user?.role === 'ADMIN') return bookingsService.getAll()
      if (user?.role === 'DEALER') return bookingsService.getDealer()
      return bookingsService.getMy()
    },
    staleTime: 30 * 1000,
  })

  const activeBookings = useMemo(() => (
    (bookingsData?.bookings || bookingsData?.data || [])
      .map(normalizeBooking)
      .filter((b) => {
        // Warehouse sees from REQUESTED onwards (dealer accepted = shipment is moving soon)
        if (user?.role === 'WAREHOUSE' || user?.role === 'CARGO_DEALER') {
          return ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(b.status)
        }
        return ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'APPROVED'].includes(b.status)
      })
  ), [bookingsData, user?.role])

  // Derived: selected booking objects in order; last one = primary
  const selectedBookings = useMemo(
    () => activeBookings.filter((b) => selectedBookingIds.has(b.id)),
    [selectedBookingIds, activeBookings]
  )
  const selectedBooking = selectedBookings[selectedBookings.length - 1] ?? null

  // ── GPS history for the selected booking ────────────────────────────────
  const { data: trackingData } = useQuery({
    queryKey: ['tracking', selectedBooking?.id],
    queryFn: () => trackingService.getHistory(selectedBooking.id),
    enabled: !!selectedBooking,
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

  // ── Fetch driving directions per booking (only when newly selected) ──────
  useEffect(() => {
    if (!selectedBooking) return
    const id = selectedBooking.id
    if (routeInfoMap[id]) return // already fetched

    const shipment = selectedBooking.shipment
    const origin = shipment?.pickupLocation || shipment?.pickup_location
    const dest = shipment?.destination || shipment?.destinationLocation

    const oLat = Number(origin?.lat ?? origin?.latitude)
    const oLng = Number(origin?.lng ?? origin?.longitude ?? origin?.lon)
    const dLat = Number(dest?.lat ?? dest?.latitude)
    const dLng = Number(dest?.lng ?? dest?.longitude ?? dest?.lon)

    if (!oLat || !oLng || !dLat || !dLng) {
      setRouteErrorMap((p) => ({ ...p, [id]: 'Route coordinates not available.' }))
      return
    }

    trackingService.getDirections(oLat, oLng, dLat, dLng)
      .then((res) => {
        const d = res?.routePath ? res : res?.data
        if (d?.routePath?.length) {
          setRouteInfoMap((p) => ({ ...p, [id]: d }))
          // Fit map to show all selected routes
          if (mapRef.current && window.google) {
            const bounds = new window.google.maps.LatLngBounds()
            Object.values({ ...routeInfoMap, [id]: d }).forEach((ri) => {
              ri.routePath?.forEach(([la, ln]) => bounds.extend({ lat: la, lng: ln }))
            })
            mapRef.current.fitBounds(bounds, 60)
          }
        } else {
          const fallback = { routePath: [[oLat, oLng], [dLat, dLng]], distanceText: 'Straight line', durationText: '—', isFallback: true }
          setRouteInfoMap((p) => ({ ...p, [id]: fallback }))
          setRouteErrorMap((p) => ({ ...p, [id]: 'Directions unavailable — straight line shown' }))
        }
      })
      .catch((err) => {
        const fallback = { routePath: [[oLat, oLng], [dLat, dLng]], distanceText: 'Straight line', durationText: '—', isFallback: true }
        setRouteInfoMap((p) => ({ ...p, [id]: fallback }))
        setRouteErrorMap((p) => ({ ...p, [id]: err?.response?.data?.message || err.message }))
      })
  }, [selectedBooking?.id])

  // ── Socket: real-time truck location updates ─────────────────────────────
  useEffect(() => {
    const socket = getSocket(token)
    if (!socket.connected) socket.connect()

    // Join personal room so warehouse receives shipment:accepted events
    if (user?.id) socket.emit('join', `user:${user.id}`)

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

    socket.on('truck:location', onTruckLoc)
    socket.on('tracking:update', onTrackingUpdate)
    return () => { socket.off('truck:location', onTruckLoc); socket.off('tracking:update', onTrackingUpdate) }
  }, [token])

  // Join socket rooms for ALL selected bookings
  useEffect(() => {
    if (selectedBookings.length === 0) return
    const socket = getSocket(token)
    selectedBookings.forEach((b) => {
      if (b.truck?.id) socket.emit('join', `truck:${b.truck.id}`)
      socket.emit('join', `booking:${b.id}`)
    })
  }, [selectedBookings, token])

  // Also join booking rooms for all active bookings so warehouse gets status updates
  useEffect(() => {
    if (activeBookings.length === 0) return
    const socket = getSocket(token)
    activeBookings.forEach((b) => {
      socket.emit('join', `booking:${b.id}`)
      if (b.truck?.id) socket.emit('join', `truck:${b.truck.id}`)
    })
  }, [activeBookings, token])

  // Warehouse: auto-refresh when a dealer accepts their shipment
  useEffect(() => {
    if (!token || user?.role !== 'WAREHOUSE') return
    const socket = getSocket(token)
    const onAccepted = () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', user?.role, 'tracking'] })
    }
    const onStatusUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', user?.role, 'tracking'] })
    }
    socket.on('shipment:accepted', onAccepted)
    socket.on('booking:statusUpdate', onStatusUpdate)
    return () => {
      socket.off('shipment:accepted', onAccepted)
      socket.off('booking:statusUpdate', onStatusUpdate)
    }
  }, [token, user?.role, queryClient])

  // Push GPS location (dealer only)
  const pushGps = useCallback(async () => {
    if (!selectedBooking || !gpsForm.lat || !gpsForm.lng) return
    setGpsPushing(true)
    try {
      await trackingService.update({
        bookingId: selectedBooking.id,
        latitude: Number(gpsForm.lat),
        longitude: Number(gpsForm.lng),
        status: gpsForm.status,
      })
      // Optimistically update local truck position
      setTruckPositions((prev) => ({
        ...prev,
        [selectedBooking.truck?.id]: { lat: Number(gpsForm.lat), lng: Number(gpsForm.lng), timestamp: new Date() },
      }))
      // Pan map to new position
      if (mapRef.current) {
        mapRef.current.panTo({ lat: Number(gpsForm.lat), lng: Number(gpsForm.lng) })
        mapRef.current.setZoom(13)
      }
    } catch (err) {
      console.error('GPS push failed:', err)
    } finally {
      setGpsPushing(false)
    }
  }, [selectedBooking, gpsForm])

  // Auto-pan when truck moves
  const selectedTruckPos = selectedBooking?.truck?.id
    ? truckPositions[selectedBooking.truck.id]
    : null
  const etaPrediction = selectedBooking?.shipment?.predictions?.find((p) => p.type === 'ETA_HOURS')
  const lastGpsAgeMin = latestGpsPoint?.timestamp
    ? (Date.now() - new Date(latestGpsPoint.timestamp).getTime()) / 60000
    : null
  const primaryRouteInfo = selectedBooking ? routeInfoMap[selectedBooking.id] : null
  const routeDeviation = primaryRouteInfo?.routePath?.length && selectedTruckPos
    ? nearestPointIdx(primaryRouteInfo.routePath, selectedTruckPos.lat, selectedTruckPos.lng) < 2
    : false

  const onMapLoad = useCallback((map) => { mapRef.current = map }, [])

  // Auto-pan map when warehouse's selected truck gets a live GPS update
  useEffect(() => {
    if (user?.role !== 'WAREHOUSE' || !selectedTruckPos || !mapRef.current) return
    mapRef.current.panTo({ lat: selectedTruckPos.lat, lng: selectedTruckPos.lng })
  }, [selectedTruckPos?.lat, selectedTruckPos?.lng])

  // ── Toggle booking selection ─────────────────────────────────────────────
  const toggleBooking = useCallback((booking) => {
    setSelectedBookingIds((prev) => {
      const next = new Set(prev)
      if (next.has(booking.id)) {
        next.delete(booking.id)
        // Clean up route data when deselected
        setRouteInfoMap((r) => { const n = { ...r }; delete n[booking.id]; return n })
        setRouteErrorMap((r) => { const n = { ...r }; delete n[booking.id]; return n })
      } else {
        next.add(booking.id)
      }
      return next
    })
  }, [])

  // ── All route polylines for Google Maps (one per selected booking) ────────
  const allRoutePolylines = useMemo(() =>
    selectedBookings.map((b, i) => {
      const info = routeInfoMap[b.id]
      if (!info?.routePath?.length) return null
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length]
      return {
        id: b.id,
        path: info.routePath.map(([la, ln]) => ({ lat: la, lng: ln })),
        options: info.isFallback
          ? { ...FALLBACK_POLYLINE_OPTIONS, strokeColor: color }
          : { strokeColor: color, strokeWeight: 5, strokeOpacity: 0.85 },
      }
    }).filter(Boolean),
    [selectedBookings, routeInfoMap]
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
    const d = s?.destination || s?.destinationLocation || s?.destination_location
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
        subtitle={
          user?.role === 'WAREHOUSE'
            ? 'Track your shipments in real-time as trucks move on the map'
            : 'Real-time GPS tracking with Google Maps driving directions'
        }
      />
      {(lastGpsAgeMin && lastGpsAgeMin > 15) || routeDeviation ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {lastGpsAgeMin && lastGpsAgeMin > 15 ? `No GPS update for ${Math.round(lastGpsAgeMin)} minutes.` : null}
            {lastGpsAgeMin && lastGpsAgeMin > 15 && routeDeviation ? ' ' : null}
            {routeDeviation ? 'Potential route deviation detected.' : null}
          </p>
        </Card>
      ) : null}

      <RouteComparisonPanel
        selectedBookings={selectedBookings}
        routeInfoMap={routeInfoMap}
        colors={ROUTE_COLORS}
        onRemove={(id) => {
          setSelectedBookingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
          setRouteInfoMap((r) => { const n = { ...r }; delete n[id]; return n })
          setRouteErrorMap((r) => { const n = { ...r }; delete n[id]; return n })
        }}
      />

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">
        {/* ── Left panel: booking list ── */}
        <div className="w-80 shrink-0 overflow-y-auto space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <SkeletonCard key={i} className="p-4" />)
          ) : activeBookings.length === 0 ? (
            <Card className="text-center py-8">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {user?.role === 'WAREHOUSE' ? 'No active shipments in transit' : 'No active deliveries'}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {user?.role === 'WAREHOUSE'
                  ? 'Shipments appear here once a truck dealer accepts your request'
                  : 'Assigned, In-Transit and Picked-Up bookings appear here'}
              </p>
            </Card>
          ) : (
            activeBookings.map((b) => {
              const livePos = truckPositions[b.truck?.id]
              const isSelected = selectedBookingIds.has(b.id)
              const colorIdx = selectedBookings.findIndex((s) => s.id === b.id)
              const routeColor = colorIdx >= 0 ? ROUTE_COLORS[colorIdx % ROUTE_COLORS.length] : null
              const routeInfo = routeInfoMap[b.id]
              const routeError = routeErrorMap[b.id]
              const etaPred = b.shipment?.predictions?.find((p) => p.type === 'ETA_HOURS')
              return (
                <Card
                  key={b.id}
                  hover
                  padding={false}
                  onClick={() => toggleBooking(b)}
                  className={`p-4 cursor-pointer transition-all ${isSelected ? 'ring-2 shadow-md' : ''}`}
                  style={isSelected && routeColor ? { '--tw-ring-color': routeColor, borderColor: routeColor + '40' } : {}}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {routeColor && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: routeColor }} />}
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
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs" style={{ color: routeColor || '#2563eb' }}>
                      <Navigation className="w-3 h-3" />
                      <span>
                        {routeInfo.distanceText} · {routeInfo.durationText}
                        {etaPred?.value ? ` · ML ETA ${Number(etaPred.value).toFixed(1)}h` : ''}
                      </span>
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

          {/* ── Unified tracking panel (dealer + warehouse) ── */}
          {selectedBooking && (
            <ShipmentTrackingPanel
              booking={selectedBooking}
              truckPos={selectedTruckPos}
              routeInfo={primaryRouteInfo}
              latestGpsPoint={latestGpsPoint}
              role={user?.role}
              gpsForm={gpsForm}
              setGpsForm={setGpsForm}
              gpsPushing={gpsPushing}
              onPush={pushGps}
              onLocate={() => {
                if (selectedTruckPos && mapRef.current) {
                  mapRef.current.panTo({ lat: selectedTruckPos.lat, lng: selectedTruckPos.lng })
                  mapRef.current.setZoom(13)
                }
              }}
            />
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
                {/* ── Road-aligned route polylines (one per selected booking) ── */}
                {allRoutePolylines.map((r) => (
                  <Polyline key={r.id} path={r.path} options={r.options} />
                ))}

                {/* ── GPS history trail (separate from route) ── */}
                {gpsFallbackPath.length > 1 && (
                  <Polyline path={gpsFallbackPath} options={{
                    strokeColor: '#f59e0b',
                    strokeWeight: 3,
                    strokeOpacity: 0.8,
                  }} />
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
                  const truckType = booking?.truck?.truckType
                  const truckLatLng = { lat: pos.lat, lng: pos.lng }
                  return (
                    <Marker
                      key={truckId}
                      position={truckLatLng}
                      icon={getTruckIcon(truckType)}
                      title={`${truckType?.replace(/_/g, ' ') || 'Truck'}: ${booking?.truck?.registrationNumber || truckId}`}
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

              {/* ── Route info + progress bar overlay (primary booking) ── */}
              <RouteInfoBar
                routeInfo={primaryRouteInfo}
                progress={!!selectedTruckPos}
                truckPos={selectedTruckPos}
              />

              {/* ── Fetching route indicator ── */}
              {selectedBooking && !primaryRouteInfo && !routeErrorMap[selectedBooking?.id] && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Fetching road directions…
                </div>
              )}

              {/* ── Route fallback notice ── */}
              {routeErrorMap[selectedBooking?.id] && gpsFallbackPath.length > 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Google Directions unavailable — showing GPS trail
                </div>
              )}

              {selectedBookingIds.size === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl p-6 text-center shadow-xl border border-gray-200 dark:border-gray-700">
                    <MapPin className="w-10 h-10 text-blue-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-700 dark:text-gray-200">Select a booking</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {user?.role === 'WAREHOUSE'
                        ? 'Click a shipment to see its live route on the map'
                        : 'Click to show route · click again to hide'}
                      <br />Select multiple to compare routes
                    </p>
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
