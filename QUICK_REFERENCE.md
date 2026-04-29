# Google Maps Tracking - Quick Reference

## 🚀 Quick Start

```bash
# Backend
cd FreightZeb/backend
npm run dev

# Frontend
cd FreightZeb/frontend
npm run dev
```

## 🔑 API Key
```
AIzaSyAduyC0WFdmEA3ePFtmriLJt3xDVWb0B-A
```

## 📍 Key URLs

| Page | URL | Description |
|------|-----|-------------|
| Tracking | `/tracking` | Public tracking page |
| Tracking with ID | `/tracking?bookingId=BK-001` | Direct tracking link |
| Booking Detail | `/bookings/:id` | Booking with location pusher |

## 🎯 API Endpoints

```javascript
// Get tracking history
GET /api/tracking/:bookingId/history

// Get latest location
GET /api/tracking/:bookingId/latest

// Push location (dealers only)
POST /api/tracking/push
{
  "bookingId": "BK-001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "status": "IN_TRANSIT"
}
```

## 🔐 Permissions

| Role | View Tracking | Push Location |
|------|---------------|---------------|
| ADMIN | ✅ All | ✅ All |
| WAREHOUSE | ✅ Own | ❌ |
| DEALER | ✅ Own | ✅ Own |
| CARGO_DEALER | ✅ Own | ✅ Own |

## 📦 Components

### TrackingPage
```javascript
import TrackingPage from './pages/TrackingPage';

// Features:
// - Google Maps with markers
// - Search by booking ID
// - Route visualization
// - Timeline view
// - Auto-refresh (30s)
```

### LocationPusher
```javascript
import LocationPusher from './components/LocationPusher';

<LocationPusher 
  bookingId="BK-001" 
  onLocationPushed={() => refetch()} 
/>

// Features:
// - Get GPS location
// - Auto-track mode
// - Push updates
// - Status buttons
```

## 🎨 Status Colors

```javascript
const statusColors = {
  PENDING: '#94a3b8',      // Gray
  PICKED_UP: '#3b82f6',    // Blue
  IN_TRANSIT: '#f59e0b',   // Orange
  DELIVERED: '#10b981',    // Green
  CANCELLED: '#ef4444',    // Red
};
```

## 🔧 Environment Variables

### Backend (.env)
```bash
GOOGLE_MAPS_API_KEY=AIzaSyAduyC0WFdmEA3ePFtmriLJt3xDVWb0B-A
DATABASE_URL=postgresql://...
PORT=5000
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAduyC0WFdmEA3ePFtmriLJt3xDVWb0B-A
```

## 🗺️ Google Maps Setup

```javascript
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

<LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
  <GoogleMap
    center={{ lat: 28.6139, lng: 77.2090 }}
    zoom={12}
  >
    <Marker position={{ lat: 28.6139, lng: 77.2090 }} />
    <Polyline path={coordinates} />
  </GoogleMap>
</LoadScript>
```

## 📱 Geolocation API

```javascript
// Get current position
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    // Use coordinates
  },
  (error) => {
    console.error('Geolocation error:', error);
  },
  {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0,
  }
);

// Watch position (continuous tracking)
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    // Update location
  },
  (error) => {
    console.error('Watch error:', error);
  }
);

// Stop watching
navigator.geolocation.clearWatch(watchId);
```

## 🔌 Socket.IO (Optional)

```javascript
import { socket } from '../lib/socket';

// Join booking room
socket.emit('join', `booking:${bookingId}`);

// Listen for updates
socket.on('tracking:update', (data) => {
  console.log('New location:', data);
  // Update map
});

// Leave room
socket.emit('leave', `booking:${bookingId}`);
```

## 🗃️ Database Schema

```prisma
model TrackingLog {
  id         String   @id @default(cuid())
  bookingId  String
  truckId    String?
  latitude   Float
  longitude  Float
  status     String
  timestamp  DateTime @default(now())
  
  booking    Booking  @relation(fields: [bookingId], references: [id])
  truck      Truck?   @relation(fields: [truckId], references: [id])
}
```

## 🐛 Common Issues

### Map not loading
```javascript
// Check API key
console.log(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

// Check browser console for errors
// Enable Maps JavaScript API in Google Cloud Console
```

### Location not updating
```javascript
// Check booking status
if (!['PICKED_UP', 'IN_TRANSIT'].includes(booking.status)) {
  console.error('Booking not active');
}

// Check user permissions
if (booking.dealerId !== user.id) {
  console.error('Not authorized');
}
```

### Browser location denied
```javascript
// Check browser settings
// Click location icon in address bar
// Allow location access
// Refresh page
```

## 📊 Testing Data

```javascript
// Sample tracking log
{
  "id": "log-1",
  "bookingId": "BK-001",
  "truckId": "TRK-001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "status": "IN_TRANSIT",
  "timestamp": "2024-01-15T10:30:00Z"
}

// Sample coordinates (Delhi to Mumbai route)
const testRoute = [
  { lat: 28.6139, lng: 77.2090 }, // Delhi
  { lat: 27.1767, lng: 78.0081 }, // Agra
  { lat: 26.9124, lng: 75.7873 }, // Jaipur
  { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
  { lat: 19.0760, lng: 72.8777 }, // Mumbai
];
```

## 🎯 Quick Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database
npm run seed

# Check for errors
npm run lint
```

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `GOOGLE_MAPS_SETUP.md` | Detailed setup guide |
| `TRACKING_QUICKSTART.md` | Quick start guide |
| `IMPLEMENTATION_SUMMARY.md` | Complete implementation details |
| `TRACKING_ARCHITECTURE.md` | System architecture |
| `TESTING_CHECKLIST.md` | Testing checklist |
| `QUICK_REFERENCE.md` | This file |

## 🔗 Useful Links

- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [React Google Maps API](https://react-google-maps-api-docs.netlify.app/)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Prisma Docs](https://www.prisma.io/docs)

## 💡 Pro Tips

1. **Use auto-refresh**: TrackingPage auto-refreshes every 30 seconds
2. **Enable auto-track**: For continuous location updates
3. **Test with real GPS**: Use mobile device for accurate testing
4. **Monitor API usage**: Check Google Cloud Console regularly
5. **Set billing alerts**: Avoid unexpected charges
6. **Use Socket.IO**: For real-time updates without polling
7. **Cache map tiles**: Improve performance
8. **Optimize markers**: Use clustering for many markers

## 🆘 Support

- **Email**: atuldenny2004@gmail.com
- **Issues**: Check browser console first
- **Logs**: Check backend logs for API errors
- **Docs**: Read GOOGLE_MAPS_SETUP.md for details

---

**Version**: 1.0.0
**Last Updated**: 2026-04-29
