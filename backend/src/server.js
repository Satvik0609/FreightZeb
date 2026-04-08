require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const { protect } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const truckRoutes = require('./routes/truckRoutes');
const mlRoutes = require('./routes/mlRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const logger = require('./config/logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*' },
});

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/shipments', protect, shipmentRoutes);
app.use('/api/trucks', protect, truckRoutes);
app.use('/api/ml', protect, mlRoutes);
app.use('/api/analytics', protect, analyticsRoutes);


io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join', (room) => {
    socket.join(room);
    logger.info(`Socket ${socket.id} joined ${room}`);
  });

  socket.on('leave', (room) => {
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDB();
  server.listen(PORT, () => {
    logger.info(`FreightZen Backend running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

bootstrap().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});