const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@freightzen.com' },
    update: {},
    create: {
      email: 'admin@freightzen.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      phone: '+1234567890'
    }
  });

  console.log('Created admin user:', admin.email);

  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatcher@freightzen.com' },
    update: {},
    create: {
      email: 'dispatcher@freightzen.com',
      password: hashedPassword,
      name: 'Dispatcher User',
      role: 'DISPATCHER',
      phone: '+1234567891'
    }
  });

  console.log('Created dispatcher user:', dispatcher.email);

  const trucks = [
    {
      registrationNo: 'TRK-001',
      type: 'SMALL_VAN',
      capacityKg: 1500,
      capacityM3: 10,
      status: 'AVAILABLE'
    },
    {
      registrationNo: 'TRK-002',
      type: 'CONTAINER_20FT',
      capacityKg: 20000,
      capacityM3: 33,
      status: 'AVAILABLE'
    },
    {
      registrationNo: 'TRK-003',
      type: 'CONTAINER_32FT',
      capacityKg: 32000,
      capacityM3: 67,
      status: 'AVAILABLE'
    },
    {
      registrationNo: 'TRK-004',
      type: 'FLATBED_TRAILER',
      capacityKg: 25000,
      capacityM3: 50,
      status: 'AVAILABLE'
    },
    {
      registrationNo: 'TRK-005',
      type: 'REEFER',
      capacityKg: 18000,
      capacityM3: 30,
      status: 'AVAILABLE'
    }
  ];

  for (const truckData of trucks) {
    const truck = await prisma.truck.upsert({
      where: { registrationNo: truckData.registrationNo },
      update: {},
      create: truckData
    });
    console.log('Created truck:', truck.registrationNo);
  }

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: hashedPassword,
      name: 'Test Customer',
      role: 'CUSTOMER',
      phone: '+1234567892'
    }
  });

  console.log('Created customer user:', customer.email);

  const sampleShipments = [
    {
      customerId: customer.id,
      origin: {
        address: 'New York, NY',
        lat: 40.7128,
        lng: -74.0060,
        city: 'New York'
      },
      destination: {
        address: 'Los Angeles, CA',
        lat: 34.0522,
        lng: -118.2437,
        city: 'Los Angeles'
      },
      weightKg: 5000,
      volumeM3: 15,
      description: 'Electronics shipment',
      status: 'PENDING'
    },
    {
      customerId: customer.id,
      origin: {
        address: 'Chicago, IL',
        lat: 41.8781,
        lng: -87.6298,
        city: 'Chicago'
      },
      destination: {
        address: 'Houston, TX',
        lat: 29.7604,
        lng: -95.3698,
        city: 'Houston'
      },
      weightKg: 12000,
      volumeM3: 25,
      description: 'Furniture shipment',
      status: 'PENDING'
    },
    {
      customerId: customer.id,
      origin: {
        address: 'Miami, FL',
        lat: 25.7617,
        lng: -80.1918,
        city: 'Miami'
      },
      destination: {
        address: 'Seattle, WA',
        lat: 47.6062,
        lng: -122.3321,
        city: 'Seattle'
      },
      weightKg: 8000,
      volumeM3: 20,
      description: 'Machinery parts',
      status: 'PENDING'
    }
  ];

  for (const shipmentData of sampleShipments) {
    const shipment = await prisma.shipment.create({
      data: shipmentData
    });
    console.log('Created shipment:', shipment.id);
  }

  console.log('Database seed completed successfully!');
  console.log('\nTest Credentials:');
  console.log('Admin: admin@freightzen.com / admin123');
  console.log('Dispatcher: dispatcher@freightzen.com / admin123');
  console.log('Customer: customer@example.com / admin123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
