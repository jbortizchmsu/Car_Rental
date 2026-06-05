process.env.TZ = 'Asia/Manila'; // Force Philippine Standard Time (UTC+8) for all date parsing and display

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import vehiclesRoutes from './routes/vehicles';
import bookingsRoutes from './routes/bookings';
import paymentsRoutes from './routes/payments';
import rentalsRoutes from './routes/rentals';
import gpsRoutes from './routes/gps';
import reportsRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import customerRoutes from './routes/customer';
import fileRoutes from './routes/files';
import maintenanceRoutes from './routes/maintenance';
import pricingRoutes from './routes/pricing';
import usersRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import { initializeBackgroundJobs } from './lib/background-jobs';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in development (including mobile LAN IPs)
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Socket.io basic connection log and room joining
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Allow clients to join their own private room for targeted notifications
  socket.on('join-room', (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Serve static uploads
const uploadDir = process.env.UPLOAD_DIR || '.uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/rentals', rentalsRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/customer/bookings', bookingsRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/admin/maintenance', maintenanceRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/admin/pricing', pricingRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api/admin/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize background alert jobs
initializeBackgroundJobs();

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 JD Car Rental API running on http://localhost:${PORT}`);
  console.log(`📂 Static uploads served at http://localhost:${PORT}/uploads`);
  console.log(`📡 WebSocket server initialized`);
});
