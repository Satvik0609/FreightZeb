# Google Maps Tracking - Testing Checklist

## Pre-Testing Setup

### 1. Environment Configuration
- [ ] Backend `.env` file has `GOOGLE_MAPS_API_KEY`
- [ ] Frontend `.env` file exists with `VITE_GOOGLE_MAPS_API_KEY`
- [ ] Both API keys match: `AIzaSyAduyC0WFdmEA3ePFtmriLJt3xDVWb0B-A`
- [ ] Database connection string is correct in backend `.env`

### 2. Google Cloud Console
- [ ] Maps JavaScript API is enabled
- [ ] API key has HTTP referrer restrictions set (optional for testing)
- [ ] Billing is enabled (or within free tier)
- [ ] No quota limits exceeded

### 3. Dependencies
- [ ] Backend: `npm install` completed successfully
- [ ] Frontend: `npm install` completed successfully
- [ ] No dependency conflicts or errors
- [ ] `@react-google-maps/api@2.20.8` is installed

### 4. Database
- [ ] Database is running (PostgreSQL)
- [ ] Prisma migrations applied: `npx prisma migrate dev`
- [ ] Seed data loaded (optional): `npm run seed`
- [ ] At least one booking exists with status PICKED_UP or IN_TRANSIT

## Application Startup

### Backend
- [ ] Start backend: `cd backend && npm run dev`
- [ ] Backend running on port 5000
- [ ] No startup errors in console
- [ ] Database connection successful
- [ ] Socket.IO initialized

### Frontend
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Frontend running on port 5173 (or 3000)
- [ ] No build errors
- [ ] Can access http://localhost:5173

## Authentication Testing

### Login
- [ ] Can access login page
- [ ] Can login as ADMIN
- [ ] Can login as WAREHOUSE
- [ ] Can login as DEALER
- [ ] JWT token stored correctly
- [ ] Redirected to dashboard after login

## TrackingPage Testing

### Basic Functionality
- [ ] Navigate to `/tracking` page
- [ ] Page loads without errors
- [ ] Search input is visible
- [ ] "Track" button is visible
- [ ] No console errors

### Search Functionality
- [ ] Enter valid booking ID (e.g., BK-001)
- [ ] Click "Track" button
- [ ] Loading spinner appears
- [ ] Data loads successfully
- [ ] No API errors

### Google Maps Display
- [ ] Map loads correctly
- [ ] No "This page can't load Google Maps correctly" error
- [ ] Map is centered on location
- [ ] Zoom level is appropriate (12)
- [ ] Map controls are visible (zoom, map type)

### Markers
- [ ] Markers appear on map
- [ ] First marker is blue
- [ ] Latest marker is green (larger)
- [ ] Intermediate markers are smaller
- [ ] Marker colors match status

### Polyline (Route)
- [ ] Blue line connects all markers
- [ ] Line follows correct path
- [ ] Line is visible and smooth
- [ ] No gaps in the line

### Info Windows
- [ ] Click on a marker
- [ ] Info window appears
- [ ] Shows status, timestamp, coordinates
- [ ] Shows truck ID if available
- [ ] Can close info window
- [ ] Can open different marker's info window

### Status Card
- [ ] Booking ID displayed correctly
- [ ] Status badge shows correct status
- [ ] Status badge has correct color
- [ ] Number of updates is correct
- [ ] "Refresh" button works

### Timeline
- [ ] Timeline section is visible
- [ ] All tracking logs displayed
- [ ] Most recent at top
- [ ] Shows status, timestamp, coordinates
- [ ] Shows truck ID if available
- [ ] Timeline icons match status

### Auto-refresh
- [ ] Wait 30 seconds
- [ ] Data refreshes automatically
- [ ] No errors during refresh
- [ ] Map updates if new data

### Error Handling
- [ ] Enter invalid booking ID
- [ ] Error message displays
- [ ] Error is user-friendly
- [ ] Can recover and search again

### Empty State
- [ ] Clear search or visit `/tracking` without ID
- [ ] Empty state message displays
- [ ] Helpful message shown
- [ ] No errors

## LocationPusher Testing

### Access Control
- [ ] Login as DEALER
- [ ] Navigate to active booking (PICKED_UP or IN_TRANSIT)
- [ ] LocationPusher component is visible
- [ ] Login as WAREHOUSE
- [ ] LocationPusher is NOT visible
- [ ] Login as ADMIN
- [ ] LocationPusher is visible (if admin is dealer)

### Get Location
- [ ] Click "Get Location" button
- [ ] Browser asks for location permission
- [ ] Allow location access
- [ ] Current location displays
- [ ] Latitude and longitude shown
- [ ] Success toast appears

### Location Display
- [ ] Location card is green
- [ ] Shows "Current Location"
- [ ] Coordinates are accurate
- [ ] Format is correct (6 decimal places)

### Auto-track Mode
- [ ] Enable "Auto-track my location" checkbox
- [ ] Location updates automatically
- [ ] "Get Location" button is disabled
- [ ] Location updates every few seconds
- [ ] Disable auto-track
- [ ] Updates stop

### Push Update
- [ ] Get current location first
- [ ] Click "Push Update" button
- [ ] Loading state shows
- [ ] Success toast appears
- [ ] Button returns to normal state
- [ ] No errors in console

### Status Buttons
- [ ] Click "Picked Up" button
- [ ] Location pushed with PICKED_UP status
- [ ] Success toast appears
- [ ] Click "In Transit" button
- [ ] Location pushed with IN_TRANSIT status
- [ ] Click "Delivered" button
- [ ] Location pushed with DELIVERED status

### Validation
- [ ] Try to push without getting location first
- [ ] Error message appears
- [ ] Try to push on completed booking
- [ ] Error message appears
- [ ] Try to push on another dealer's booking
- [ ] Forbidden error appears

## BookingDetailPage Integration

### Component Visibility
- [ ] Login as DEALER
- [ ] Open active booking (PICKED_UP or IN_TRANSIT)
- [ ] LocationPusher appears at bottom
- [ ] Open completed booking (DELIVERED)
- [ ] LocationPusher does NOT appear
- [ ] Open pending booking (REQUESTED)
- [ ] LocationPusher does NOT appear

### Layout
- [ ] LocationPusher is in right column
- [ ] Below Lifecycle timeline
- [ ] Proper spacing and styling
- [ ] Responsive on mobile

### Integration
- [ ] Push location from BookingDetailPage
- [ ] Success toast appears
- [ ] Booking data refreshes
- [ ] Navigate to TrackingPage
- [ ] New location appears on map

## End-to-End Flow

### Complete Tracking Flow
1. [ ] Login as DEALER
2. [ ] Navigate to active booking
3. [ ] Click "Get Location"
4. [ ] Allow browser permission
5. [ ] Click "Push Update"
6. [ ] Success toast appears
7. [ ] Logout
8. [ ] Login as WAREHOUSE (or different user)
9. [ ] Navigate to `/tracking`
10. [ ] Enter booking ID
11. [ ] Click "Track"
12. [ ] See new location on map
13. [ ] Verify marker appears
14. [ ] Verify timeline updated
15. [ ] Click marker
16. [ ] Info window shows correct data

### Multiple Updates Flow
1. [ ] Login as DEALER
2. [ ] Push location from location A
3. [ ] Move to location B (or simulate)
4. [ ] Push location from location B
5. [ ] Move to location C
6. [ ] Push location from location C
7. [ ] Navigate to TrackingPage
8. [ ] Verify all 3 locations on map
9. [ ] Verify polyline connects them
10. [ ] Verify timeline shows all 3

## Browser Compatibility

### Chrome
- [ ] All features work
- [ ] Map loads correctly
- [ ] Geolocation works
- [ ] No console errors

### Firefox
- [ ] All features work
- [ ] Map loads correctly
- [ ] Geolocation works
- [ ] No console errors

### Safari
- [ ] All features work
- [ ] Map loads correctly
- [ ] Geolocation works
- [ ] No console errors

### Edge
- [ ] All features work
- [ ] Map loads correctly
- [ ] Geolocation works
- [ ] No console errors

## Mobile Testing

### Responsive Design
- [ ] TrackingPage responsive on mobile
- [ ] Map displays correctly
- [ ] Search form usable
- [ ] Timeline readable
- [ ] LocationPusher usable on mobile

### Mobile Geolocation
- [ ] Geolocation works on mobile
- [ ] GPS coordinates accurate
- [ ] Auto-track works on mobile
- [ ] Push updates work on mobile

## Performance Testing

### Load Times
- [ ] TrackingPage loads in < 3 seconds
- [ ] Map renders in < 2 seconds
- [ ] API responses in < 500ms
- [ ] No lag when interacting

### Large Datasets
- [ ] Test with 50+ tracking logs
- [ ] Map still performs well
- [ ] Timeline scrolls smoothly
- [ ] No memory leaks

### Network Conditions
- [ ] Test on slow 3G
- [ ] Loading states appear
- [ ] Graceful degradation
- [ ] Error handling works

## Security Testing

### Authentication
- [ ] Cannot access tracking without login
- [ ] Cannot push location without login
- [ ] JWT token required for all requests
- [ ] Invalid token rejected

### Authorization
- [ ] DEALER can only push own bookings
- [ ] WAREHOUSE cannot push locations
- [ ] ADMIN can access all bookings
- [ ] Cannot access other users' bookings

### Input Validation
- [ ] Invalid coordinates rejected
- [ ] Invalid booking ID handled
- [ ] SQL injection prevented
- [ ] XSS attacks prevented

## Error Scenarios

### Network Errors
- [ ] Disconnect internet
- [ ] Try to load tracking
- [ ] Error message appears
- [ ] Reconnect internet
- [ ] Can retry successfully

### API Errors
- [ ] Backend returns 500 error
- [ ] Error message displays
- [ ] User can retry
- [ ] No app crash

### Google Maps Errors
- [ ] Invalid API key (test temporarily)
- [ ] Error message displays
- [ ] App doesn't crash
- [ ] Restore valid key

### Geolocation Errors
- [ ] Deny location permission
- [ ] Error message displays
- [ ] Can try again
- [ ] No app crash

## Socket.IO Testing (Optional)

### Connection
- [ ] Socket connects on page load
- [ ] Connection status shows "Live"
- [ ] Disconnect shows "Offline"
- [ ] Reconnects automatically

### Real-time Updates
- [ ] Open TrackingPage in two browsers
- [ ] Push location from one browser
- [ ] Other browser receives update
- [ ] Marker appears in real-time
- [ ] Toast notification shows
- [ ] Timeline updates

### Room Management
- [ ] Join correct booking room
- [ ] Only receive updates for that booking
- [ ] Leave room when navigating away
- [ ] No memory leaks

## Documentation Review

### Code Documentation
- [ ] Components have clear comments
- [ ] Functions documented
- [ ] Props documented
- [ ] Complex logic explained

### User Documentation
- [ ] GOOGLE_MAPS_SETUP.md is clear
- [ ] TRACKING_QUICKSTART.md is helpful
- [ ] IMPLEMENTATION_SUMMARY.md is complete
- [ ] TRACKING_ARCHITECTURE.md is accurate

## Production Readiness

### Environment Variables
- [ ] Production API key configured
- [ ] Production API URL configured
- [ ] Secrets not in code
- [ ] .env files in .gitignore

### API Key Restrictions
- [ ] Production domain in HTTP referrers
- [ ] Localhost removed from restrictions
- [ ] API restrictions set
- [ ] Billing alerts configured

### Monitoring
- [ ] Error tracking set up (Sentry, etc.)
- [ ] Analytics configured
- [ ] Logging configured
- [ ] Alerts configured

### Performance
- [ ] Code minified
- [ ] Assets optimized
- [ ] Caching configured
- [ ] CDN configured (if applicable)

## Final Checks

### Code Quality
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] Consistent formatting
- [ ] No linting errors

### Git
- [ ] All changes committed
- [ ] .env files not committed
- [ ] Meaningful commit messages
- [ ] Branch up to date

### Deployment
- [ ] Build succeeds: `npm run build`
- [ ] No build warnings
- [ ] Production build tested
- [ ] Ready to deploy

## Sign-off

- [ ] All critical tests passed
- [ ] All blockers resolved
- [ ] Documentation complete
- [ ] Ready for production

---

**Tested by**: _________________
**Date**: _________________
**Version**: 1.0.0
**Status**: ☐ Pass ☐ Fail ☐ Needs Review

**Notes**:
_____________________________________________
_____________________________________________
_____________________________________________
