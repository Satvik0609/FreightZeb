/**
 * Quick script to create a test booking with IN_TRANSIT status
 * and add sample tracking data for testing Google Maps
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestBooking() {
    try {
        console.log('🔍 Looking for existing data...\n');

        // Find a warehouse user
        const warehouse = await prisma.user.findFirst({
            where: { role: 'WAREHOUSE' }
        });

        // Find a dealer user
        const dealer = await prisma.user.findFirst({
            where: { role: 'DEALER' }
        });

        // Find an available truck
        const truck = await prisma.truck.findFirst({
            where: { status: 'AVAILABLE' }
        });

        if (!warehouse || !dealer || !truck) {
            console.log('❌ Missing required data. Please run: npm run seed');
            process.exit(1);
        }

        console.log('✅ Found warehouse:', warehouse.email);
        console.log('✅ Found dealer:', dealer.email);
        console.log('✅ Found truck:', truck.registrationNo);
        console.log('');

        // Create a shipment
        const shipment = await prisma.shipment.create({
            data: {
                warehouseId: warehouse.id,
                weightKg: 5000,
                volumeM3: 20,
                boxes: 100,
                pickupLocation: {
                    lat: 28.6139,
                    lng: 77.2090,
                    address: 'Plot 22, Okhla Industrial Area Phase II',
                    city: 'New Delhi',
                    state: 'Delhi',
                    pincode: '110020'
                },
                destination: {
                    lat: 19.0760,
                    lng: 72.8777,
                    address: 'Plot 47, MIDC Andheri Industrial Estate',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    pincode: '400093'
                },
                deadline: new Date(Date.now() + 2 * 86400000), // 2 days from now
                description: 'Test shipment - Electronics components (200 cartons)',
                requirements: {
                    hazardous: false,
                    fragile: true,
                    tempControlled: false,
                    oversized: false
                },
                status: 'BOOKED'
            }
        });

        console.log('✅ Created shipment:', shipment.id);

        // Create a booking with IN_TRANSIT status
        const booking = await prisma.booking.create({
            data: {
                shipmentId: shipment.id,
                truckId: truck.id,
                warehouseId: warehouse.id,
                dealerId: dealer.id,
                status: 'IN_TRANSIT',
                distanceKm: 1415,
                pricing: {
                    base: 56600,
                    weightSurcharge: 0,
                    fuel: 39096,
                    toll: 2971.5,
                    driverAllowance: 2000,
                    subtotal: 100667.5,
                    gst: 5033.38,
                    total: 105700.88,
                    currency: 'INR'
                },
                estimatedEta: new Date(Date.now() + 36 * 3600000), // 36 hours from now
                pickedUpAt: new Date(Date.now() - 6 * 3600000), // 6 hours ago
            }
        });

        console.log('✅ Created booking:', booking.id);
        console.log('');

        // Add tracking logs (Delhi to Mumbai route)
        const trackingPoints = [
            { lat: 28.6139, lng: 77.2090, status: 'PICKED_UP', hoursAgo: 6 }, // Delhi
            { lat: 28.4089, lng: 77.3178, status: 'IN_TRANSIT', hoursAgo: 5 }, // Faridabad
            { lat: 27.1767, lng: 78.0081, status: 'IN_TRANSIT', hoursAgo: 3 }, // Agra
            { lat: 26.4499, lng: 77.6737, status: 'IN_TRANSIT', hoursAgo: 1 }, // Gwalior
        ];

        for (const point of trackingPoints) {
            await prisma.trackingLog.create({
                data: {
                    bookingId: booking.id,
                    truckId: truck.id,
                    latitude: point.lat,
                    longitude: point.lng,
                    status: point.status,
                    timestamp: new Date(Date.now() - point.hoursAgo * 3600000)
                }
            });
        }

        console.log('✅ Added', trackingPoints.length, 'tracking points');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 SUCCESS! Test booking created with tracking data');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📍 BOOKING ID:', booking.id);
        console.log('');
        console.log('🗺️  Test it now:');
        console.log('   1. Go to: http://localhost:5173/tracking');
        console.log('   2. Enter booking ID:', booking.id);
        console.log('   3. Click "Track"');
        console.log('');
        console.log('📊 Route: Delhi → Agra → Gwalior → Mumbai');
        console.log('🚛 Truck:', truck.registrationNo);
        console.log('📦 Status: IN_TRANSIT');
        console.log('📍 Current location: Near Gwalior (last update 1 hour ago)');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createTestBooking();
