# Google Maps Tracking - Quick Start Guide

## Setup Complete! ✅

Your Google Maps API integration is ready to use. Here's what was configured:

### Files Created/Updated:
1. ✅ `backend/.env` - Added Google Maps API key
2. ✅ `frontend/.env` - Added Google Maps API key for Vite
3. ✅ `frontend/src/pages/TrackingPage.jsx` - Full tracking page with Google Maps
4. ✅ `frontend/src/components/LocationPusher.jsx` - Location update component for drivers
5. ✅ `frontend/src/pages/BookingDetailPage.jsx` - Enhanced with location pusher

## Quick Test (5 minutes)

### Step 1: Start the Application

```bash
# Terminal 1 - Backend
cd FreightZeb/backend
npm install
npm run dev

# Terminal 2 - Frontend  
cd FreightZeb/frontend
npm install
npm run dev
```

### Step 2: Create Test Data

1. Login as ADMIN or WAREHOUSE user
2. Create a booking or use existing one
3. Update booking status to `PICKED_UP` or `IN_TRANSIT`

### Step 3: Test Location Tracking

#### As Dealer (Push Location):
1. Login as the dealer assigned to the booking
2. Go to Bookings → Click on your active booking
3. You'll see the "Update Location" card at the bottom
4. Click "Get Location" (allow browser location access)
5. Click "Push Update" to send location to server
6. Try the status buttons: "Picked Up", "In Transit", "Delivered"

#### As Customer (View Tracking):
1. Navigate to `/tracking` page
2. Enter the booking ID (e.g., `BK-001`)
3. Click "Track"
4. You'll see:
   - 🗺️ Google Map with route and markers
   - 📍 All location updates on the map
   - 📋 Timeline of tracking history
   - 🔄 Auto-refresh every 30 seconds

## Features Overview

### TrackingPage Features:
- ✅ Real-time Google Maps display
- ✅ Search by booking ID
- ✅ Visual route with polylines
- ✅ Interactive markers with info windows
- ✅ Color-coded status markers
- ✅ Timeline view of all updates
- ✅ Auto-refresh every 30 seconds
- ✅ Responsive design

### LocationPusher Features:
- ✅ Get current GPS location
- ✅ Auto-track mode for continuous updates
- ✅ Push location to backend
- ✅ Update shipment status
- ✅ Real-time location display
- ✅ Only visible to dealers on active bookings

## API Endpoints Used

```javascript
// Get tracking history
GET /api/tracking/:bookingId/history

// Push location update (dealers only)
POST /api/tracking/push
{
  "bookingId": "BK-001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "status": "IN_TRANSIT"
}

// Get latest location
GET /api/tracking/:bookingId/latest
```

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access tracking page at `/tracking`
- [ ] Can search for booking by ID
- [ ] Map loads correctly (no API key errors)
- [ ] Can see markers on map
- [ ] Can click markers to see info windows
- [ ] Timeline shows all updates
- [ ] LocationPusher appears for dealers on active bookings
- [ ] Can get current location (browser permission)
- [ ] Can push location updates
- [ ] Can update booking status
- [ ] Map updates after pushing new location

## Troubleshooting

### Map Not Loading
**Error**: "This page can't load Google Maps correctly"
**Solution**: 
1. Check browser console for specific error
2. Verify API key in `frontend/.env`
3. Ensure Maps JavaScript API is enabled in Google Cloud Console
4. Check API key restrictions (HTTP referrers)

### Location Not Updating
**Error**: "Failed to update location"
**Solution**:
1. Check browser console for errors
2. Verify booking status is PICKED_UP or IN_TRANSIT
3. Ensure logged-in user is the dealer for this booking
4. Check backend logs for errors

### Browser Location Access Denied
**Error**: "Unable to get your location"
**Solution**:
1. Click the location icon in browser address bar
2. Allow location access for localhost
3. Refresh the page
4. Try "Get Location" again

### API Key Errors
**Error**: "RefererNotAllowedMapError"
**Solution**: Add `http://localhost:3000/*` and `http://localhost:5173/*` to HTTP referrer restrictions

**Error**: "ApiNotActivatedMapError"
**Solution**: Enable Maps JavaScript API in Google Cloud Console

## Next Steps

### Immediate Enhancements:
1. Add Socket.IO real-time updates to TrackingPage
2. Add "View on Map" button in BookingsPage
3. Show mini-map in booking cards
4. Add estimated time of arrival (ETA) calculation

### Advanced Features:
1. Implement geocoding for address display
2. Add route optimization with Directions API
3. Create geofencing for automatic status updates
4. Add offline location caching
5. Implement driver mobile app
6. Add traffic layer to map
7. Show multiple trucks on same map

## Production Deployment

Before deploying to production:

1. **Update Environment Variables**:
   ```bash
   # Production frontend .env
   VITE_API_URL=https://api.yourdomain.com
   VITE_GOOGLE_MAPS_API_KEY=your_production_key
   ```

2. **Restrict API Key**:
   - Add production domain to HTTP referrers
   - Remove localhost from restrictions
   - Set up billing alerts

3. **Enable HTTPS**:
   - Google Maps requires HTTPS in production
   - Set up SSL certificates

4. **Monitor Usage**:
   - Set up Google Cloud billing alerts
   - Monitor API usage in console
   - Implement rate limiting

## Support

- **Email**: atuldenny2004@gmail.com
- **Documentation**: See `GOOGLE_MAPS_SETUP.md` for detailed setup
- **Google Maps Docs**: https://developers.google.com/maps/documentation

## Demo Credentials

Use these for testing (if available in your seed data):

```
Admin:
Email: admin@freightzeb.com
Password: [your password]

Dealer:
Email: dealer@freightzeb.com  
Password: [your password]

Warehouse:
Email: warehouse@freightzeb.com
Password: [your password]
```

---

**Status**: ✅ Ready to test!
**Last Updated**: 2026-04-29
