# Google Maps API Integration Setup

This document explains how to set up and use the Google Maps tracking feature in FreightZeb.

## API Key Configuration

Your Google Maps JavaScript API key has been configured in the following files:

### Backend (.env)
```
GOOGLE_MAPS_API_KEY=AIzaSyAduyC0WFdmEA3ePFtmriLJt3xDVWb0B-A
```

### Frontend (.env)
```
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAduyC0WFdmEA3ePFtmriLJt3xDVWb0B-A
```

## Required Google Cloud APIs

Make sure the following APIs are enabled in your Google Cloud Console:
1. **Maps JavaScript API** - For displaying maps
2. **Geocoding API** (optional) - For address lookups
3. **Directions API** (optional) - For route planning

### Enable APIs:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Library"
4. Search for and enable each API listed above

## API Key Restrictions (Recommended)

For security, restrict your API key:

### Application Restrictions:
- **HTTP referrers (websites)**: Add your domains
  - `http://localhost:3000/*`
  - `http://localhost:5173/*` (Vite dev server)
  - `https://yourdomain.com/*` (production)

### API Restrictions:
- Restrict key to only the APIs you need:
  - Maps JavaScript API
  - Geocoding API (if used)
  - Directions API (if used)

## Features Implemented

### 1. TrackingPage Component
Location: `FreightZeb/frontend/src/pages/TrackingPage.jsx`

Features:
- Real-time shipment tracking with Google Maps
- Search by booking ID
- Visual route display with polylines
- Interactive markers showing tracking history
- Timeline view of all location updates
- Auto-refresh every 30 seconds
- Responsive map with zoom controls

### 2. LocationPusher Component
Location: `FreightZeb/frontend/src/components/LocationPusher.jsx`

Features:
- Get current GPS location
- Auto-track mode for continuous updates
- Push location updates to backend
- Update shipment status (Picked Up, In Transit, Delivered)
- Real-time location display

## Usage

### For Customers (Tracking)

1. Navigate to the Tracking page
2. Enter your booking ID (e.g., BK-001)
3. Click "Track" to view:
   - Current location on map
   - Complete route history
   - Timeline of all updates
   - Shipment status

### For Dealers/Drivers (Location Updates)

Use the LocationPusher component in your booking detail page:

```jsx
import LocationPusher from '../components/LocationPusher';

<LocationPusher 
  bookingId="BK-001" 
  onLocationPushed={() => refetch()} 
/>
```

Features:
- Click "Get Location" to acquire current GPS position
- Enable "Auto-track" for continuous location monitoring
- Click "Push Update" to send location to server
- Use status buttons to update shipment status

## API Endpoints

### Get Tracking History
```
GET /api/tracking/:bookingId/history
```

Response:
```json
{
  "success": true,
  "bookingId": "BK-001",
  "status": "IN_TRANSIT",
  "trackingLogs": [
    {
      "id": "log-1",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "status": "PICKED_UP",
      "timestamp": "2024-01-15T10:30:00Z",
      "truckId": "TRK-001"
    }
  ]
}
```

### Push Location Update
```
POST /api/tracking/push
```

Request:
```json
{
  "bookingId": "BK-001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "status": "IN_TRANSIT"
}
```

## Real-time Updates

The tracking system uses Socket.IO for real-time updates:

```javascript
// Backend emits updates
io.to(`booking:${bookingId}`).emit('tracking:update', {
  bookingId,
  truckId,
  latitude,
  longitude,
  status,
  timestamp
});

// Frontend listens (implement in TrackingPage)
socket.on('tracking:update', (data) => {
  // Update map markers and timeline
});
```

## Testing

### Test the Tracking Page:
1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Create a booking with status PICKED_UP or IN_TRANSIT
4. Navigate to `/tracking?bookingId=YOUR_BOOKING_ID`
5. You should see the map with tracking data

### Test Location Pushing:
1. Open browser console and allow location access
2. Use the LocationPusher component
3. Click "Get Location" to acquire GPS coordinates
4. Click "Push Update" to send to backend
5. Check the tracking page to see the new marker

## Troubleshooting

### Map not loading:
- Check browser console for API key errors
- Verify API key is correctly set in `.env` files
- Ensure Maps JavaScript API is enabled in Google Cloud Console
- Check for CORS issues

### Location not updating:
- Verify browser has location permissions
- Check network tab for failed API requests
- Ensure booking status is PICKED_UP or IN_TRANSIT
- Verify user has permission (dealer/admin only)

### API Key Errors:
- `RefererNotAllowedMapError`: Add your domain to HTTP referrer restrictions
- `ApiNotActivatedMapError`: Enable Maps JavaScript API in Google Cloud Console
- `RequestDenied`: Check API restrictions match your usage

## Cost Optimization

Google Maps API usage is billed per request:
- **Map loads**: $7 per 1,000 loads
- **Dynamic Maps**: $14 per 1,000 loads

Tips to reduce costs:
1. Implement map caching
2. Use static maps for non-interactive views
3. Set up billing alerts in Google Cloud Console
4. Monitor usage in Google Cloud Console

## Security Best Practices

1. **Never commit API keys to version control**
   - Use `.env` files (already in `.gitignore`)
   - Use environment variables in production

2. **Restrict API keys**
   - Add HTTP referrer restrictions
   - Limit to specific APIs
   - Rotate keys periodically

3. **Monitor usage**
   - Set up billing alerts
   - Review API usage regularly
   - Check for unauthorized access

## Next Steps

1. Add Socket.IO real-time updates to TrackingPage
2. Implement geocoding for address display
3. Add route optimization with Directions API
4. Create driver mobile app for easier location updates
5. Add geofencing for automatic status updates
6. Implement offline location caching

## Support

For issues or questions:
- Email: atuldenny2004@gmail.com
- Check Google Maps Platform documentation: https://developers.google.com/maps/documentation
