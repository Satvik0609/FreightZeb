/**
 * Get bookings for a specific user email
 * Usage: node get-my-bookings.js <email>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getMyBookings() {
    const email = process.argv[2];

    if (!email) {
        console.log('Usage: node get-my-bookings.js <email>');
        console.log('');
        console.log('Examples:');
        console.log('  node get-my-bookings.js admin@freightzen.in');
        console.log('  node get-my-bookings.js ops@delhivery-warehouse.in');
        console.log('  node get-my-bookings.js fleet@vrl-logistics.in');
        process.exit(1);
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true, role: true }
        });

        if (!user) {
            console.log('❌ User not found:', email);
            process.exit(1);
        }

        console.log('👤 User:', user.name, `(${user.role})`);
        console.log('📧 Email:', user.email);
        console.log('');

        let bookings;

        if (user.role === 'ADMIN') {
            bookings = await prisma.booking.findMany({
                include: {
                    trackingLogs: true,
                    warehouse: { select: { name: true, company: true } },
                    dealer: { select: { name: true, company: true } },
                    truck: { select: { registrationNo: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
            console.log('🔓 Admin access - showing ALL bookings');
        } else if (user.role === 'DEALER' || user.role === 'CARGO_DEALER') {
            bookings = await prisma.booking.findMany({
                where: { dealerId: user.id },
                include: {
                    trackingLogs: true,
                    warehouse: { select: { name: true, company: true } },
                    truck: { select: { registrationNo: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
            console.log('🚛 Dealer bookings (your trucks)');
        } else {
            bookings = await prisma.booking.findMany({
                where: { warehouseId: user.id },
                include: {
                    trackingLogs: true,
                    dealer: { select: { name: true, company: true } },
                    truck: { select: { registrationNo: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
            console.log('📦 Warehouse bookings (your shipments)');
        }

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Found ${bookings.length} bookings`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        if (bookings.length === 0) {
            console.log('No bookings found for this user.');
            console.log('');
            console.log('💡 Try:');
            console.log('   1. Run: node create-test-booking.js');
            console.log('   2. Or use a different user email');
            process.exit(0);
        }

        // Show bookings with tracking data
        const withTracking = bookings.filter(b => b.trackingLogs.length > 0);
        const inTransit = bookings.filter(b => ['PICKED_UP', 'IN_TRANSIT'].includes(b.status));

        console.log('📊 Summary:');
        console.log('   Total bookings:', bookings.length);
        console.log('   With tracking data:', withTracking.length);
        console.log('   In transit (can track):', inTransit.length);
        console.log('');

        if (withTracking.length > 0) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ BOOKINGS WITH TRACKING DATA (Ready to test!)');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');

            withTracking.forEach((booking, index) => {
                console.log(`${index + 1}. Booking ID: ${booking.id}`);
                console.log(`   Status: ${booking.status}`);
                console.log(`   Truck: ${booking.truck?.registrationNo || 'N/A'}`);
                console.log(`   Tracking points: ${booking.trackingLogs.length}`);
                if (user.role === 'ADMIN') {
                    console.log(`   Warehouse: ${booking.warehouse?.company || booking.warehouse?.name}`);
                    console.log(`   Dealer: ${booking.dealer?.company || booking.dealer?.name}`);
                } else if (user.role === 'DEALER' || user.role === 'CARGO_DEALER') {
                    console.log(`   Warehouse: ${booking.warehouse?.company || booking.warehouse?.name}`);
                } else {
                    console.log(`   Dealer: ${booking.dealer?.company || booking.dealer?.name}`);
                }
                console.log('');
                console.log(`   🗺️  Test now: http://localhost:5173/tracking?bookingId=${booking.id}`);
                console.log('');
            });
        }

        if (inTransit.length > 0 && withTracking.length === 0) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📍 IN-TRANSIT BOOKINGS (Need tracking data)');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');
            console.log('These bookings are in transit but have no tracking data yet.');
            console.log('You can add tracking data by:');
            console.log('  1. Login as dealer');
            console.log('  2. Go to booking detail page');
            console.log('  3. Use "Update Location" feature');
            console.log('');

            inTransit.forEach((booking, index) => {
                console.log(`${index + 1}. Booking ID: ${booking.id}`);
                console.log(`   Status: ${booking.status}`);
                console.log(`   Truck: ${booking.truck?.registrationNo || 'N/A'}`);
                console.log('');
            });
        }

        if (withTracking.length === 0 && inTransit.length === 0) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 ALL BOOKINGS');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');

            bookings.slice(0, 5).forEach((booking, index) => {
                console.log(`${index + 1}. Booking ID: ${booking.id}`);
                console.log(`   Status: ${booking.status}`);
                console.log(`   Truck: ${booking.truck?.registrationNo || 'N/A'}`);
                console.log('');
            });

            if (bookings.length > 5) {
                console.log(`   ... and ${bookings.length - 5} more`);
                console.log('');
            }

            console.log('💡 To test tracking:');
            console.log('   1. Run: node create-test-booking.js');
            console.log('   2. This will create a booking with tracking data');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

getMyBookings();
