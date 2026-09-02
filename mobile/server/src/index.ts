process.env.TZ = 'Asia/Manila'; // Force Philippine Standard Time (UTC+8) for all date parsing and display

import express from 'express';
import helmet from 'helmet';
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

const PORT = process.env.PORT || 4000;

// Allowed CORS origins — set ALLOWED_ORIGINS in .env for production (comma-separated)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'https://car-rental-project-5a58.vercel.app'];

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Trust first proxy (nginx) for accurate IP-based rate limiting
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // allow file serving across origins
}));

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS policy: origin ${origin} is not allowed`));
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

// NOTE: /uploads static route intentionally removed.
// All file access is authenticated through /api/files/:fileId

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
  console.log(`🔒 File access via authenticated /api/files/:fileId only`);
  console.log(`📡 WebSocket server initialized`);
});
