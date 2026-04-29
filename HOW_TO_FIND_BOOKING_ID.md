# How to Find Booking IDs

## Where Are Booking IDs?

Booking IDs are **UUIDs** (Universally Unique Identifiers) stored in your database. They look like this:
```
Full ID: 550e8400-e29b-41d4-a716-446655440000
Displayed: 550e8400 (first 8 characters)
```

## 3 Ways to Find Booking IDs

### Method 1: Through the Web Interface (Easiest)

1. **Start the application**:
   ```bash
   # Backend
   cd FreightZeb/backend
   npm run dev
   
   # Frontend (new terminal)
   cd FreightZeb/frontend
   npm run dev
   ```

2. **Login** to the application at `http://localhost:5173`

3. **Navigate to Bookings page**:
   - Click "Bookings" in the sidebar
   - You'll see a list of all bookings

4. **Find the Booking ID**:
   - In the "Booking" column, you'll see IDs like `550e8400`
   - This is the **first 8 characters** of the full booking ID
   - Click on any booking to see more details

5. **Get the Full ID**:
   - Click on a booking row
   - Look at the URL: `/bookings/550e8400-e29b-41d4-a716-446655440000`
   - The full UUID is in the URL

### Method 2: From the Database (Direct)

1. **Connect to your database**:
   ```bash
   cd FreightZeb/backend
   npx prisma studio
   ```

2. **Open Prisma Studio** in your browser (usually `http://localhost:5555`)

3. **Click on "Booking" model**

4. **See all bookings** with their full IDs in the `id` column

5. **Copy any booking ID** to use for tracking

### Method 3: Using Database Query

If you have PostgreSQL client installed:

```bash
# Connect to database
psql "postgresql://neondb_owner:npg_S9Ccq6gaywpe@ep-steep-dew-a14g87r0-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# List all bookings
SELECT id, status, "createdAt" FROM "Booking" ORDER BY "createdAt" DESC LIMIT 10;

# Get bookings with tracking data
SELECT b.id, b.status, COUNT(t.id) as tracking_count
FROM "Booking" b
LEFT JOIN "TrackingLog" t ON t."bookingId" = b.id
GROUP BY b.id, b.status
HAVING COUNT(t.id) > 0;
```

## Creating Test Bookings

If you don't have any bookings yet, here's how to create them:

### Option 1: Run the Seed Script

```bash
cd FreightZeb/backend
npm run seed
```

This will create:
- 8 warehouse users
- 7 dealer users
- 45+ trucks
- 50+ shipments
- Multiple bookings with different statuses

### Option 2: Create Through the UI

1. **Login as Warehouse** (e.g., `ops@delhivery-warehouse.in` / `Warehouse@1234`)
2. **Go to Shipments page**
3. **Create a new shipment**
4. **Click "Optimize"** to find trucks
5. **Accept a truck** to create a booking
6. **Go to Bookings page** to see your new booking

### Option 3: Create via API

```bash
# First, login to get a token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ops@delhivery-warehouse.in","password":"Warehouse@1234"}'

# Use the token to create a shipment and booking
# (See API documentation for full flow)
```

## Testing the Tracking Page

Once you have a booking ID:

### 1. Add Tracking Data

You need to push at least one location update:

**Option A: Through UI (as Dealer)**
1. Login as dealer (e.g., `fleet@vrl-logistics.in` / `Dealer@1234`)
2. Go to Bookings page
3. Click on a booking with status `PICKED_UP` or `IN_TRANSIT`
4. Scroll down to "Update Location" card
5. Click "Get Location" → Allow browser permission
6. Click "Push Update"

**Option B: Via API**
```bash
# Login as dealer
TOKEN="your_jwt_token_here"

# Push location
curl -X POST http://localhost:5000/api/tracking/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "status": "IN_TRANSIT"
  }'
```

### 2. View on Tracking Page

1. Go to `http://localhost:5173/tracking`
2. Enter the booking ID (full UUID or first 8 characters)
3. Click "Track"
4. See the map with your location!

## Quick Test with Sample Data

If you ran the seed script, here are some sample credentials:

### Warehouse Users
```
Email: ops@delhivery-warehouse.in
Password: Warehouse@1234
```

### Dealer Users
```
Email: fleet@vrl-logistics.in
Password: Dealer@1234
```

### Admin User
```
Email: admin@freightzen.in
Password: Admin@1234
```

## Booking Status Flow

For tracking to work, bookings must be in these statuses:
- ✅ **PICKED_UP** - Dealer can push location
- ✅ **IN_TRANSIT** - Dealer can push location
- ❌ **REQUESTED** - Too early, no tracking yet
- ❌ **APPROVED** - Not picked up yet
- ❌ **DELIVERED** - Already completed
- ❌ **CANCELLED** - Cancelled booking

## Example Booking IDs from Seed Data

After running `npm run seed`, you'll have bookings like:
- Check Prisma Studio or database for actual IDs
- They will be UUIDs like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

## Troubleshooting

### "No bookings found"
- Run the seed script: `cd backend && npm run seed`
- Or create bookings through the UI

### "Booking not found" on tracking page
- Make sure you're using the **full UUID**, not just first 8 characters
- Check the booking exists in database
- Verify you have permission to view it

### "No tracking data yet"
- Booking must have status `PICKED_UP` or `IN_TRANSIT`
- Dealer must push at least one location update
- Check TrackingLog table in database

## Database Schema Reference

```sql
-- Booking table
CREATE TABLE "Booking" (
  "id" TEXT PRIMARY KEY,           -- This is the booking ID (UUID)
  "shipmentId" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "status" TEXT NOT NULL,          -- PICKED_UP or IN_TRANSIT for tracking
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- TrackingLog table
CREATE TABLE "TrackingLog" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,       -- References Booking.id
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "status" TEXT,
  "timestamp" TIMESTAMP DEFAULT NOW()
);
```

## Quick Commands

```bash
# See all bookings
cd FreightZeb/backend
npx prisma studio

# Run seed to create test data
npm run seed

# Check database directly
psql $DATABASE_URL -c "SELECT id, status FROM \"Booking\" LIMIT 5;"

# Get bookings with tracking
psql $DATABASE_URL -c "SELECT DISTINCT b.id, b.status FROM \"Booking\" b JOIN \"TrackingLog\" t ON t.\"bookingId\" = b.id;"
```

---

**TL;DR**: 
1. Run `npm run seed` in backend
2. Login to `http://localhost:5173`
3. Go to Bookings page
4. Copy any booking ID from the list
5. Use it on the Tracking page!
