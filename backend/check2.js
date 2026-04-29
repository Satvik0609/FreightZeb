require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
    .then(() => { console.log('DB CONNECTED OK'); return p.$disconnect(); })
    .catch(e => { console.error('FAILED:', e.message); process.exit(1); });
