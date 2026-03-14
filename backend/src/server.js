require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const { protect } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');


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


io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined ${room}`);
  });

  socket.on('leave', (room) => {
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Freightzeb Backend → http://localhost:${PORT}`);
  });
}

bootstrap();