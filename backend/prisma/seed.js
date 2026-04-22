/**
 * Prisma Seed — realistic Indian logistics data (small scale)
 * ~20 users, 40 trucks, 50 shipments, 50 bookings, tracking logs, invoices
 * Run: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const hash = (pw) => bcrypt.hash(pw, 10);

// ── Cities ────────────────────────────────────────────────────────────────────
const CITIES = {
    mumbai: { lat: 19.0760, lng: 72.8777, city: 'Mumbai', state: 'Maharashtra' },
    delhi: { lat: 28.6139, lng: 77.2090, city: 'Delhi', state: 'Delhi' },
    bangalore: { lat: 12.9716, lng: 77.5946, city: 'Bangalore', state: 'Karnataka' },
    pune: { lat: 18.5204, lng: 73.8567, city: 'Pune', state: 'Maharashtra' },
    hyderabad: { lat: 17.3850, lng: 78.4867, city: 'Hyderabad', state: 'Telangana' },
    chennai: { lat: 13.0827, lng: 80.2707, city: 'Chennai', state: 'Tamil Nadu' },
    ahmedabad: { lat: 23.0225, lng: 72.5714, city: 'Ahmedabad', state: 'Gujarat' },
    kolkata: { lat: 22.5726, lng: 88.3639, city: 'Kolkata', state: 'West Bengal' },
    jaipur: { lat: 26.9124, lng: 75.7873, city: 'Jaipur', state: 'Rajasthan' },
    surat: { lat: 21.1702, lng: 72.8311, city: 'Surat', state: 'Gujarat' },
    nagpur: { lat: 21.1458, lng: 79.0882, city: 'Nagpur', state: 'Maharashtra' },
    lucknow: { lat: 26.8467, lng: 80.9462, city: 'Lucknow', state: 'Uttar Pradesh' },
};

const ROAD_KM = {
    'mumbai-delhi': 1415, 'mumbai-pune': 148, 'mumbai-bangalore': 984,
    'mumbai-ahmedabad': 524, 'mumbai-hyderabad': 711, 'mumbai-surat': 284,
    'mumbai-nagpur': 836, 'delhi-jaipur': 281, 'delhi-kolkata': 1472,
    'delhi-ahmedabad': 944, 'delhi-hyderabad': 1568, 'delhi-lucknow': 555,
    'delhi-chennai': 2180, 'bangalore-chennai': 346, 'bangalore-hyderabad': 570,
    'bangalore-pune': 836, 'hyderabad-chennai': 627, 'hyderabad-kolkata': 1495,
    'pune-ahmedabad': 660, 'surat-ahmedabad': 265, 'nagpur-hyderabad': 500,
    'lucknow-kolkata': 980, 'jaipur-ahmedabad': 660,
};

function distKm(a, b) {
    return ROAD_KM[[a, b].sort().join('-')] || 700;
}

function loc(cityKey, address, pincode) {
    const c = CITIES[cityKey];
    return { lat: c.lat + (Math.random() - 0.5) * 0.05, lng: c.lng + (Math.random() - 0.5) * 0.05, address, city: c.city, state: c.state, pincode };
}

function pricing(distanceKm, weightKg, pricePerKm) {
    const base = distanceKm * pricePerKm;
    const weightSur = weightKg > 10000 ? weightKg * 0.8 : 0;
    const fuel = distanceKm * 12;
    const toll = Math.round(distanceKm / 100) * 180;
    const subtotal = base + weightSur + fuel + toll;
    const gst = parseFloat((subtotal * 0.18).toFixed(2));
    const total = parseFloat((subtotal + gst).toFixed(2));
    return { base: parseFloat(base.toFixed(2)), weightSurcharge: parseFloat(weightSur.toFixed(2)), fuel: parseFloat(fuel.toFixed(2)), toll, subtotal: parseFloat(subtotal.toFixed(2)), gst, total, currency: 'INR' };
}

const rnd = (min, max) => Math.random() * (max - min) + min;
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysAhead = (n) => new Date(Date.now() + n * 86400000);
const hoursAgo = (n) => new Date(Date.now() - n * 3600000);

// ── Seed data definitions ─────────────────────────────────────────────────────

const WAREHOUSE_USERS = [
    { email: 'ops@bharat-logistics.in', name: 'Priya Sharma', company: 'Bharat Logistics Pvt Ltd', phone: '+919876543201', city: 'mumbai' },
    { email: 'ops@delhi-cargo.in', name: 'Vikram Singh', company: 'Delhi Cargo Hub', phone: '+919876543202', city: 'delhi' },
    { email: 'ops@southex-warehousing.in', name: 'Kavitha Nair', company: 'SouthEx Warehousing Solutions', phone: '+919876543203', city: 'bangalore' },
    { email: 'ops@pune-logistics.in', name: 'Rahul Desai', company: 'Pune Logistics Centre', phone: '+919876543204', city: 'pune' },
    { email: 'ops@hyderabad-freight.in', name: 'Srinivas Rao', company: 'Hyderabad Freight Hub', phone: '+919876543205', city: 'hyderabad' },
    { email: 'ops@chennai-warehouse.in', name: 'Meenakshi Iyer', company: 'Chennai Warehouse Services', phone: '+919876543206', city: 'chennai' },
    { email: 'ops@gujarat-cargo.in', name: 'Hardik Shah', company: 'Gujarat Cargo Solutions', phone: '+919876543207', city: 'ahmedabad' },
];

const DEALER_USERS = [
    { email: 'fleet@rajesh-transport.in', name: 'Rajesh Patel', company: 'Rajesh Transport Co.', phone: '+919123456781' },
    { email: 'fleet@speedline-carriers.in', name: 'Suresh Kumar', company: 'Speedline Carriers Ltd', phone: '+919123456782' },
    { email: 'fleet@deccan-freight.in', name: 'Anand Reddy', company: 'Deccan Freight Services', phone: '+919123456783' },
    { email: 'fleet@northern-movers.in', name: 'Gurpreet Singh', company: 'Northern Movers Pvt Ltd', phone: '+919123456784' },
    { email: 'fleet@coastal-logistics.in', name: 'Ramesh Nair', company: 'Coastal Logistics India', phone: '+919123456785' },
    { email: 'fleet@express-freight.in', name: 'Deepak Joshi', company: 'Express Freight Solutions', phone: '+919123456786' },
];

const TRUCK_TYPES = ['SMALL_VAN', 'CONTAINER_20FT', 'CONTAINER_32FT', 'FLATBED_TRAILER', 'REEFER'];
const TRUCK_SPECS = {
    SMALL_VAN: { capKg: 1500, capM3: 8, ppkMin: 12, ppkMax: 16 },
    CONTAINER_20FT: { capKg: 12000, capM3: 33, ppkMin: 28, ppkMax: 35 },
    CONTAINER_32FT: { capKg: 25000, capM3: 76, ppkMin: 36, ppkMax: 44 },
    FLATBED_TRAILER: { capKg: 30000, capM3: 90, ppkMin: 26, ppkMax: 32 },
    REEFER: { capKg: 10000, capM3: 28, ppkMin: 42, ppkMax: 52 },
};

const CITY_PAIRS = [
    ['mumbai', 'delhi'], ['mumbai', 'pune'], ['mumbai', 'bangalore'], ['mumbai', 'ahmedabad'],
    ['mumbai', 'hyderabad'], ['mumbai', 'surat'], ['mumbai', 'nagpur'],
    ['delhi', 'jaipur'], ['delhi', 'kolkata'], ['delhi', 'ahmedabad'], ['delhi', 'lucknow'],
    ['bangalore', 'chennai'], ['bangalore', 'hyderabad'], ['bangalore', 'pune'],
    ['hyderabad', 'chennai'], ['pune', 'ahmedabad'], ['nagpur', 'hyderabad'],
    ['lucknow', 'kolkata'], ['jaipur', 'ahmedabad'], ['surat', 'ahmedabad'],
];

const SHIPMENT_DESCS = [
    'Auto spare parts — engine components and filters',
    'Pharmaceutical raw materials — temperature sensitive',
    'Consumer electronics — TVs and laptops',
    'MS steel coils and structural sections',
    'Garment export consignment — readymade apparel',
    'FMCG goods — packaged food and beverages',
    'Machine tools and precision instruments',
    'Construction equipment — hydraulic machinery',
    'IT hardware — servers and networking equipment',
    'Semiconductor components and PCB assemblies',
    'Frozen food products — ice cream and dairy',
    'Automotive components — gearboxes and axles',
    'Specialty chemicals — lab reagents',
    'Textile machinery parts and accessories',
    'Leather goods and accessories',
    'Agricultural produce — fresh vegetables',
    'Furniture and home decor items',
    'Medical equipment — diagnostic devices',
    'Plastic raw materials — granules and pellets',
    'Paper and packaging materials',
];

const SHIPMENT_STATUSES = ['PENDING', 'PENDING', 'PENDING', 'BOOKED', 'BOOKED', 'IN_TRANSIT', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED', 'CANCELLED'];
const BOOKING_STATUSES = { PENDING: 'REQUESTED', OPTIMIZED: 'REQUESTED', BOOKED: 'APPROVED', IN_TRANSIT: 'IN_TRANSIT', DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED' };

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('🌱 Seeding FreightZen (small scale)...\n');

    // 1. Admin
    const admin = await prisma.user.upsert({
        where: { email: 'admin@freightzen.in' },
        update: {},
        create: {
            email: 'admin@freightzen.in', password: await hash('Admin@1234'),
            name: 'Arjun Mehta', role: 'ADMIN',
            company: 'FreightZen Technologies', phone: '+919900000001',
        },
    });

    // 2. Warehouse users
    console.log('👤 Creating users...');
    const warehouses = [];
    for (const u of WAREHOUSE_USERS) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { email: u.email, password: await hash('Warehouse@1234'), name: u.name, role: 'WAREHOUSE', company: u.company, phone: u.phone },
        });
        warehouses.push({ ...user, city: u.city });
    }

    // 3. Dealer users
    const dealers = [];
    for (const u of DEALER_USERS) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { email: u.email, password: await hash('Dealer@1234'), name: u.name, role: 'DEALER', company: u.company, phone: u.phone },
        });
        dealers.push(user);
    }
    console.log(`  ✅ ${1 + warehouses.length + dealers.length} users\n`);

    // 4. Trucks — ~6-7 per dealer = ~40 total
    console.log('🚛 Creating trucks...');
    const trucks = [];
    const regNums = new Set();

    const truckCities = ['mumbai', 'delhi', 'bangalore', 'pune', 'hyderabad', 'chennai', 'ahmedabad'];
    const truckStatuses = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'IN_TRANSIT', 'BOOKED', 'MAINTENANCE'];

    for (const dealer of dealers) {
        const count = rndInt(6, 7);
        for (let i = 0; i < count; i++) {
            const type = pick(TRUCK_TYPES);
            const spec = TRUCK_SPECS[type];
            const fromCity = pick(truckCities);
            const toCity = pick(truckCities.filter(c => c !== fromCity));
            const status = pick(truckStatuses);
            const avail = status === 'AVAILABLE';
            const c = CITIES[fromCity];

            // Generate unique reg number
            let reg;
            do {
                const state = pick(['MH', 'DL', 'KA', 'GJ', 'TN', 'TS', 'UP', 'RJ', 'WB']);
                const num = rndInt(1000, 9999);
                const alpha = String.fromCharCode(65 + rndInt(0, 25)) + String.fromCharCode(65 + rndInt(0, 25));
                reg = `${state}-${rndInt(1, 25).toString().padStart(2, '0')}-${alpha}-${num}`;
            } while (regNums.has(reg));
            regNums.add(reg);

            const truck = await prisma.truck.upsert({
                where: { registrationNo: reg },
                update: {},
                create: {
                    dealerId: dealer.id,
                    registrationNo: reg,
                    truckType: type,
                    capacityKg: spec.capKg,
                    capacityM3: spec.capM3,
                    routeFrom: CITIES[fromCity].city,
                    routeTo: CITIES[toCity].city,
                    pricePerKm: parseFloat(rnd(spec.ppkMin, spec.ppkMax).toFixed(1)),
                    status,
                    availability: avail,
                    currentLocation: avail ? { lat: c.lat, lng: c.lng, lastUpdated: new Date().toISOString() } : null,
                },
            });
            trucks.push({ ...truck, dealerRef: dealer });
        }
    }
    console.log(`  ✅ ${trucks.length} trucks\n`);

    // 5. Shipments — 50 total
    console.log('📦 Creating shipments...');
    const shipments = [];

    for (let i = 0; i < 50; i++) {
        const wh = pick(warehouses);
        const pair = pick(CITY_PAIRS);
        const [from, to] = pair;
        const status = pick(SHIPMENT_STATUSES);
        const weight = rndInt(500, 25000);
        const volume = parseFloat((weight / rndInt(250, 400)).toFixed(1));

        const ship = await prisma.shipment.create({
            data: {
                warehouseId: wh.id,
                weightKg: weight,
                volumeM3: volume,
                boxes: rndInt(5, 150),
                pickupLocation: loc(from, `${rndInt(1, 200)} Industrial Area, ${CITIES[from].city}`, `${rndInt(100000, 999999)}`),
                destination: loc(to, `${rndInt(1, 200)} Warehouse Zone, ${CITIES[to].city}`, `${rndInt(100000, 999999)}`),
                deadline: daysAhead(rndInt(1, 10)),
                description: pick(SHIPMENT_DESCS),
                requirements: {
                    hazardous: Math.random() < 0.08,
                    fragile: Math.random() < 0.25,
                    tempControlled: Math.random() < 0.15,
                    oversized: Math.random() < 0.10,
                },
                status,
            },
        });
        shipments.push({ ...ship, fromCity: from, toCity: to, whRef: wh });
    }
    console.log(`  ✅ ${shipments.length} shipments\n`);

    // 6. Bookings + tracking + invoices
    console.log('📋 Creating bookings, tracking logs, invoices...');
    let bookingCount = 0, trackingCount = 0, invoiceCount = 0;

    for (const ship of shipments) {
        if (ship.status === 'PENDING') continue;  // no booking for pure pending

        const bStatus = BOOKING_STATUSES[ship.status] || 'REQUESTED';
        const dist = distKm(ship.fromCity, ship.toCity);
        const truck = pick(trucks);
        const dealer = truck.dealerRef;
        const p = pricing(dist, ship.weightKg, truck.pricePerKm || 30);
        const createdAt = daysAgo(rndInt(1, 10));
        const pickedUpAt = ['IN_TRANSIT', 'DELIVERED'].includes(bStatus) ? new Date(createdAt.getTime() + 86400000) : null;
        const deliveredAt = bStatus === 'DELIVERED' ? new Date(createdAt.getTime() + rndInt(2, 6) * 86400000) : null;

        const booking = await prisma.booking.create({
            data: {
                shipmentId: ship.id,
                truckId: truck.id,
                warehouseId: ship.whRef.id,
                dealerId: dealer.id,
                status: bStatus,
                distanceKm: dist,
                pricing: p,
                estimatedEta: new Date(createdAt.getTime() + (dist / 60) * 3600000),
                optimScore: parseFloat(rnd(0.70, 0.96).toFixed(2)),
                notes: Math.random() > 0.4 ? pick(['Priority delivery', 'Handle with care', 'Fragile items', 'Temperature sensitive', 'Insured consignment']) : null,
                pickedUpAt,
                deliveredAt,
                createdAt,
            },
        });
        bookingCount++;

        // Tracking logs for in-transit and delivered
        if (['IN_TRANSIT', 'DELIVERED'].includes(bStatus)) {
            const fromC = CITIES[ship.fromCity];
            const toC = CITIES[ship.toCity];
            const steps = rndInt(3, 6);
            for (let s = 0; s < steps; s++) {
                const frac = s / (steps - 1);
                await prisma.trackingLog.create({
                    data: {
                        bookingId: booking.id,
                        truckId: truck.id,
                        latitude: fromC.lat + (toC.lat - fromC.lat) * frac + rnd(-0.3, 0.3),
                        longitude: fromC.lng + (toC.lng - fromC.lng) * frac + rnd(-0.3, 0.3),
                        status: s === 0 ? 'PICKED_UP' : s === steps - 1 && bStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
                        timestamp: new Date(createdAt.getTime() + s * (dist / 60 / steps) * 3600000),
                    },
                });
                trackingCount++;
            }
        }

        // Invoice for delivered bookings
        if (bStatus === 'DELIVERED') {
            const invStatus = Math.random() > 0.4 ? 'PAID' : 'PENDING';
            await prisma.invoice.create({
                data: {
                    bookingId: booking.id,
                    userId: ship.whRef.id,
                    invoiceNo: `INV-${Date.now()}-${rndInt(1000, 9999)}`,
                    pricing: p,
                    status: invStatus,
                    dueDate: new Date((deliveredAt || new Date()).getTime() + 7 * 86400000),
                    paidAt: invStatus === 'PAID' ? new Date((deliveredAt || new Date()).getTime() + rndInt(1, 5) * 86400000) : null,
                },
            });
            invoiceCount++;
        }
    }
    console.log(`  ✅ ${bookingCount} bookings, ${trackingCount} tracking logs, ${invoiceCount} invoices\n`);

    // 7. Notifications
    console.log('🔔 Creating notifications...');
    const notifTypes = ['BOOKING_REQUESTED', 'BOOKING_APPROVED', 'SHIPMENT_IN_TRANSIT', 'SHIPMENT_DELIVERED', 'SYSTEM_ALERT'];
    const allUsers = [admin, ...warehouses, ...dealers];
    let notifCount = 0;

    for (let i = 0; i < 40; i++) {
        const user = pick(allUsers);
        const type = pick(notifTypes);
        await prisma.notification.create({
            data: {
                userId: user.id,
                type,
                title: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                message: `Notification #${i + 1} — ${type.toLowerCase().replace(/_/g, ' ')} event for your account.`,
                isRead: Math.random() > 0.5,
                createdAt: hoursAgo(rndInt(1, 72)),
            },
        });
        notifCount++;
    }
    console.log(`  ✅ ${notifCount} notifications\n`);

    // 8. ML Predictions
    console.log('🤖 Creating ML predictions...');
    const predTypes = ['ETA_HOURS', 'DELAY_RISK_PERCENT', 'FUEL_ESTIMATE_LITERS', 'CO2_KG', 'RECOMMENDED_TRUCK_SCORE'];
    let predCount = 0;

    for (const ship of shipments.slice(0, 30)) {
        const numPreds = rndInt(1, 3);
        const types = [...predTypes].sort(() => Math.random() - 0.5).slice(0, numPreds);
        for (const type of types) {
            const value = type === 'ETA_HOURS' ? parseFloat(rnd(2, 36).toFixed(1))
                : type === 'DELAY_RISK_PERCENT' ? parseFloat(rnd(5, 60).toFixed(1))
                    : type === 'FUEL_ESTIMATE_LITERS' ? parseFloat(rnd(30, 500).toFixed(1))
                        : type === 'CO2_KG' ? parseFloat(rnd(50, 1200).toFixed(1))
                            : parseFloat(rnd(0.65, 0.98).toFixed(2));

            await prisma.prediction.create({
                data: {
                    shipmentId: ship.id,
                    type,
                    value,
                    confidence: parseFloat(rnd(0.72, 0.97).toFixed(2)),
                    modelVersion: '2.1.0',
                },
            });
            predCount++;
        }
    }
    console.log(`  ✅ ${predCount} ML predictions\n`);

    // Summary
    const counts = await Promise.all([
        prisma.user.count(), prisma.truck.count(), prisma.shipment.count(),
        prisma.booking.count(), prisma.trackingLog.count(), prisma.invoice.count(),
        prisma.notification.count(), prisma.prediction.count(),
    ]);

    console.log('═══════════════════════════════════════════════');
    console.log('🎉  FreightZen seed complete!');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Users         : ${counts[0]}`);
    console.log(`  Trucks        : ${counts[1]}`);
    console.log(`  Shipments     : ${counts[2]}`);
    console.log(`  Bookings      : ${counts[3]}`);
    console.log(`  Tracking logs : ${counts[4]}`);
    console.log(`  Invoices      : ${counts[5]}`);
    console.log(`  Notifications : ${counts[6]}`);
    console.log(`  Predictions   : ${counts[7]}`);
    console.log('═══════════════════════════════════════════════');
    console.log('\nLogin credentials:');
    console.log('  Admin     → admin@freightzen.in            / Admin@1234');
    console.log('  Warehouse → ops@bharat-logistics.in        / Warehouse@1234');
    console.log('  Dealer    → fleet@rajesh-transport.in      / Dealer@1234\n');
}

main()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
