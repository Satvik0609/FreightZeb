# Tracking System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FREIGHTZEB TRACKING                      │
│                     Google Maps Integration                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                  │         │                  │         │                  │
│   CUSTOMERS      │         │   DEALERS        │         │   WAREHOUSES     │
│   (Track)        │         │   (Push)         │         │   (Monitor)      │
│                  │         │                  │         │                  │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┐    ┌────────────────────┐              │
│  │  TrackingPage      │    │  LocationPusher    │              │
│  │  - Google Maps     │    │  - Geolocation API │              │
│  │  - Search by ID    │    │  - Auto-track      │              │
│  │  - View route      │    │  - Push updates    │              │
│  │  - Timeline        │    │  - Status buttons  │              │
│  └────────┬───────────┘    └────────┬───────────┘              │
│           │                         │                           │
│           └─────────┬───────────────┘                           │
│                     │                                            │
│              ┌──────▼──────┐                                    │
│              │   Axios API  │                                    │
│              │   + Socket.IO│                                    │
│              └──────┬───────┘                                    │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      │ HTTP/WebSocket
                      │
┌─────────────────────▼────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Tracking Controller                         │    │
│  │  - getTrackingHistory()  GET /tracking/:id/history      │    │
│  │  - getLatestLocation()   GET /tracking/:id/latest       │    │
│  │  - pushLocation()        POST /tracking/push            │    │
│  └────────┬────────────────────────────────────────────────┘    │
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Auth Middleware                             │    │
│  │  - Verify JWT token                                      │    │
│  │  - Check user role                                       │    │
│  │  - Validate permissions                                  │    │
│  └────────┬────────────────────────────────────────────────┘    │
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Prisma ORM                                  │    │
│  │  - TrackingLog model                                     │    │
│  │  - Booking model                                         │    │
│  │  - Truck model                                           │    │
│  └────────┬────────────────────────────────────────────────┘    │
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Socket.IO                                   │    │
│  │  - Emit tracking:update events                           │    │
│  │  - Room: booking:{bookingId}                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐    ┌────────────────┐    ┌──────────────┐ │
│  │  TrackingLog   │    │    Booking     │    │    Truck     │ │
│  │  - id          │    │    - id        │    │    - id      │ │
│  │  - bookingId   │◄───┤    - status    │    │    - regNo   │ │
│  │  - truckId     │    │    - dealerId  │    │    - type    │ │
│  │  - latitude    │    │    - warehouseId│   │    - location│ │
│  │  - longitude   │    │    - truckId   │───►│              │ │
│  │  - status      │    │    - shipmentId│    │              │ │
│  │  - timestamp   │    └────────────────┘    └──────────────┘ │
│  └────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Google Maps JavaScript API                      │    │
│  │  - Map rendering                                        │    │
│  │  - Markers & InfoWindows                                │    │
│  │  - Polylines (routes)                                   │    │
│  │  - Geocoding (optional)                                 │    │
│  │  - Directions (optional)                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Browser Geolocation API                         │    │
│  │  - getCurrentPosition()                                 │    │
│  │  - watchPosition()                                      │    │
│  │  - GPS coordinates                                      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Customer Tracking Flow

```
Customer enters booking ID
         │
         ▼
TrackingPage component
         │
         ▼
GET /api/tracking/:id/history
         │
         ▼
Auth middleware validates user
         │
         ▼
Controller checks permissions
         │
         ▼
Prisma fetches TrackingLog records
         │
         ▼
Response with tracking data
         │
         ▼
Google Maps renders:
  - Markers for each location
  - Polyline showing route
  - InfoWindows with details
         │
         ▼
Timeline displays history
```

### 2. Dealer Location Push Flow

```
Dealer opens active booking
         │
         ▼
LocationPusher component visible
         │
         ▼
Dealer clicks "Get Location"
         │
         ▼
Browser Geolocation API
  - Requests permission
  - Gets GPS coordinates
         │
         ▼
Dealer clicks "Push Update"
         │
         ▼
POST /api/tracking/push
  {
    bookingId,
    latitude,
    longitude,
    status
  }
         │
         ▼
Auth middleware validates dealer
         │
         ▼
Controller validates:
  - Booking exists
  - Dealer owns booking
  - Status is PICKED_UP/IN_TRANSIT
         │
         ▼
Prisma transaction:
  1. Create TrackingLog
  2. Update Truck.currentLocation
         │
         ▼
Socket.IO emits to room:
  io.to(`booking:${id}`)
    .emit('tracking:update', data)
         │
         ▼
Response with created log
         │
         ▼
Frontend shows success toast
         │
         ▼
All connected clients receive update
```

### 3. Real-time Update Flow (Socket.IO)

```
Client opens TrackingPage
         │
         ▼
Socket connects to server
         │
         ▼
Client joins room: booking:{id}
         │
         ▼
[Dealer pushes location]
         │
         ▼
Server emits to room:
  tracking:update event
         │
         ▼
All clients in room receive:
  {
    bookingId,
    truckId,
    latitude,
    longitude,
    status,
    timestamp
  }
         │
         ▼
Client updates:
  - Adds marker to map
  - Updates polyline
  - Shows toast notification
  - Adds to timeline
  - Centers map on new location
```

## Component Hierarchy

```
App
│
├── Router
│   │
│   ├── TrackingPage
│   │   ├── SearchForm
│   │   ├── StatusCard
│   │   ├── GoogleMap
│   │   │   ├── Polyline (route)
│   │   │   ├── Marker[] (locations)
│   │   │   └── InfoWindow (details)
│   │   └── Timeline
│   │
│   └── BookingDetailPage
│       ├── StatusCard
│       ├── PartyInfo
│       ├── ActionButtons
│       ├── Lifecycle Timeline
│       └── LocationPusher (if dealer + active)
│           ├── LocationDisplay
│           ├── AutoTrackToggle
│           ├── GetLocationButton
│           ├── PushUpdateButton
│           └── StatusButtons
│
└── Socket.IO Provider
    └── Connection management
```

## Database Schema

```sql
-- TrackingLog table
CREATE TABLE "TrackingLog" (
  "id"         TEXT PRIMARY KEY,
  "bookingId"  TEXT NOT NULL,
  "truckId"    TEXT,
  "latitude"   DOUBLE PRECISION NOT NULL,
  "longitude"  DOUBLE PRECISION NOT NULL,
  "status"     TEXT NOT NULL,
  "timestamp"  TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id"),
  FOREIGN KEY ("truckId") REFERENCES "Truck"("id")
);

-- Booking table (relevant fields)
CREATE TABLE "Booking" (
  "id"          TEXT PRIMARY KEY,
  "status"      TEXT NOT NULL,
  "dealerId"    TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "truckId"     TEXT,
  "shipmentId"  TEXT NOT NULL,
  
  FOREIGN KEY ("dealerId") REFERENCES "User"("id"),
  FOREIGN KEY ("warehouseId") REFERENCES "User"("id"),
  FOREIGN KEY ("truckId") REFERENCES "Truck"("id")
);

-- Truck table (relevant fields)
CREATE TABLE "Truck" (
  "id"              TEXT PRIMARY KEY,
  "registrationNo"  TEXT UNIQUE NOT NULL,
  "truckType"       TEXT NOT NULL,
  "currentLocation" JSONB,
  -- currentLocation: { lat, lng, lastUpdated }
);
```

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tracking/:bookingId/history` | Required | Get all tracking logs for a booking |
| GET | `/api/tracking/:bookingId/latest` | Required | Get latest location for a booking |
| POST | `/api/tracking/push` | Dealer only | Push new location update |

## Permission Matrix

| Role | View Tracking | Push Location | Update Status |
|------|---------------|---------------|---------------|
| ADMIN | ✅ All | ✅ All | ✅ All |
| WAREHOUSE | ✅ Own bookings | ❌ | ❌ |
| DEALER | ✅ Own bookings | ✅ Own bookings | ✅ Own bookings |
| CARGO_DEALER | ✅ Own bookings | ✅ Own bookings | ✅ Own bookings |
| Customer (public) | ❌ | ❌ | ❌ |

## Status Transitions

```
REQUESTED
    │
    ▼
APPROVED ──────► REJECTED
    │
    ▼
ASSIGNED
    │
    ▼
PICKED_UP ◄──── [Location tracking starts]
    │
    ▼
IN_TRANSIT ◄─── [Active location tracking]
    │
    ▼
DELIVERED ◄──── [Location tracking ends]
    │
    ▼
[Invoice generated]
```

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **Vite 7.0.6** - Build tool
- **@react-google-maps/api 2.20.8** - Google Maps integration
- **@tanstack/react-query 5.80.7** - Data fetching & caching
- **axios 1.11.0** - HTTP client
- **socket.io-client 4.8.1** - Real-time communication
- **lucide-react 0.525.0** - Icons
- **react-hot-toast 2.5.2** - Notifications
- **date-fns 4.1.0** - Date formatting
- **tailwindcss 3.4.17** - Styling

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Prisma** - ORM
- **PostgreSQL** - Database
- **Socket.IO** - Real-time communication
- **JWT** - Authentication

### External Services
- **Google Maps JavaScript API** - Map rendering
- **Browser Geolocation API** - GPS coordinates

## Security Features

1. **Authentication**: JWT token required for all endpoints
2. **Authorization**: Role-based access control
3. **Validation**: Input validation on all endpoints
4. **API Key Restrictions**: HTTP referrer restrictions
5. **HTTPS**: Required for Geolocation API in production
6. **Rate Limiting**: Prevent abuse
7. **CORS**: Configured for frontend domain

## Performance Optimizations

1. **React Query Caching**: Reduces API calls
2. **Auto-refresh**: 30-second interval (configurable)
3. **Lazy Loading**: Components loaded on demand
4. **Debounced Search**: Prevents excessive API calls
5. **Socket.IO**: Real-time updates without polling
6. **Indexed Database**: Fast queries on bookingId

## Monitoring & Analytics

### Metrics to Track
- Map load time
- Location update frequency
- API response times
- Error rates
- User engagement
- Google Maps API usage
- Socket.IO connection stability

### Logging
- All location updates logged
- API errors logged
- Socket.IO events logged
- User actions logged

## Future Enhancements

### Phase 1 (Immediate)
- [ ] Socket.IO real-time updates
- [ ] ETA calculation
- [ ] Mini-map in booking cards
- [ ] "View on Map" buttons

### Phase 2 (Short-term)
- [ ] Geocoding for addresses
- [ ] Route optimization
- [ ] Geofencing
- [ ] Traffic layer
- [ ] Offline caching

### Phase 3 (Long-term)
- [ ] Driver mobile app
- [ ] Predictive ETA with ML
- [ ] Multi-truck view
- [ ] Heatmap visualization
- [ ] Weather overlay
- [ ] Route replay

---

**Last Updated**: 2026-04-29
**Version**: 1.0.0
