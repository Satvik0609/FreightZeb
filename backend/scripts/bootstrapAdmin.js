require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@freightzeb.in';
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin@1234';
  const name = process.env.ADMIN_BOOTSTRAP_NAME || 'Platform Admin';
  const company = process.env.ADMIN_BOOTSTRAP_COMPANY || 'FreightZeb';
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE || null;

  if (password.length < 8) {
    throw new Error('ADMIN bootstrap password must be at least 8 characters.');
  }

  const hashed = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      company,
      phone,
      role: 'ADMIN',
      isActive: true,
      password: hashed,
    },
    create: {
      email,
      password: hashed,
      name,
      role: 'ADMIN',
      company,
      phone,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  console.log('Admin bootstrap complete:');
  console.log(JSON.stringify(admin));
}

main()
  .catch((err) => {
    console.error('Admin bootstrap failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
