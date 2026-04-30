require('dotenv').config();

// ── Validate ENV before anything else ───────────────────────────────────────
const { validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const { prisma, connectDB, disconnectDB } = require('./config/db');
const logger = require('./config/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const requestId = require('./middleware/requestId');
const { startAllJobs } = require('./services/cronService');
const { startMlWorker } = require('./queues/mlQueue');

const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const truckRoutes = require('./routes/truckRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const consolidationRoutes = require('./routes/consolidationRoutes');
const loadingRoutes = require('./routes/loadingRoutes');
const mlRoutes = require('./routes/mlRoutes');
const mapsRoutes = require('./routes/mapsRoutes');

const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Security & performance ───────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Request ID (for log tracing) ─────────────────────────────────────────────
app.use(requestId);
app.use((req, res, next) => {
  req.setTimeout(30_000);
  res.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: 'Request timed out. Please try again.',
        requestId: req.requestId,
      });
    }
  });
  next();
});

// ── HTTP request logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url === '/health',
  }));
}

// ── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Share io with controllers ────────────────────────────────────────────────
app.set('io', io);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const health = {
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
    res.json(health);
  } catch (_err) {
    health.status = 'degraded';
    health.database = 'disconnected';
    res.status(503).json(health);
  }
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/shipments', consolidationRoutes);
app.use('/api/trucks', loadingRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/maps', mapsRoutes);

// ── 404 + Global error handler ───────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Socket.io rooms ──────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers?.authorization;
    const authToken = socket.handshake.auth?.token;
    const token = authToken || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true, passwordChangedAt: true },
    });

    if (!user || !user.isActive) return next(new Error('Authentication failed'));

    if (user.passwordChangedAt) {
      const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if ((decoded.iat || 0) < changedAtSeconds) {
        return next(new Error('Authentication expired'));
      }
    }

    socket.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (_err) {
    next(new Error('Authentication failed'));
  }
});

async function canJoinRoom(socket, room) {
  const [type, id] = String(room || '').split(':');
  if (!type || !id) return false;

  if (socket.user.role === 'ADMIN') return true;

  if ((type === 'user' || type === 'warehouse' || type === 'dealer') && id === socket.user.id) {
    return true;
  }

  if (type === 'booking') {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { warehouseId: true, dealerId: true },
    });
    return !!booking && (booking.warehouseId === socket.user.id || booking.dealerId === socket.user.id);
  }

  if (type === 'truck') {
    const truck = await prisma.truck.findUnique({
      where: { id },
      select: { dealerId: true },
    });
    if (!!truck && truck.dealerId === socket.user.id) return true;

    // Warehouse can also watch a truck if it has an active booking for their shipment
    const activeBooking = await prisma.booking.findFirst({
      where: {
        truckId: id,
        warehouseId: socket.user.id,
        status: { in: ['APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
      },
      select: { id: true },
    });
    return !!activeBooking;
  }

  return false;
}

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (${socket.user.id})`);

  /**
   * Room naming convention:
   *   user:<userId>       → personal notifications
   *   booking:<id>        → booking updates + live tracking
   *   warehouse:<userId>  → warehouse-wide events
   *   dealer:<userId>     → dealer-wide events
   *   truck:<truckId>     → live GPS location
   */
  socket.on('join', async (room) => {
    try {
      const allowed = await canJoinRoom(socket, room);
      if (!allowed) {
        socket.emit('error', { message: 'Access denied to room' });
        return;
      }

      socket.join(room);
      logger.info(`Socket ${socket.id} joined: ${room}`);
    } catch (_err) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('leave', (room) => socket.leave(room));

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

startMlWorker(io);

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await disconnectDB();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// ── Bootstrap ────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  await connectDB();
  startAllJobs();
  server.listen(PORT, () => {
    logger.info(`🚛 FreightZeb API → http://localhost:${PORT}  [${process.env.NODE_ENV}]`);
  });
}

bootstrap();
