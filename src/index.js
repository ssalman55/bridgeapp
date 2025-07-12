const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const dotenv = require('dotenv');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const fileRoutes = require('./routes/fileRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const bulletinRoutes = require('./routes/bulletinRoutes');
const eventRoutes = require('./routes/eventRoutes');
const documentRoutes = require('./routes/documentRoutes');
const performanceEvaluationRoutes = require('./routes/performanceEvaluationRoutes');
const peerRecognitionRoutes = require('./routes/peerRecognitionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const authorizedNetworkRoutes = require('./routes/authorizedNetworkRoutes');
const geofenceRoutes = require('./routes/geofenceRoutes');
const geofenceSettingsRoutes = require('./routes/geofenceSettingsRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const staffProfileRoutes = require('./routes/staffProfileRoutes');
const taskRoutes = require('./routes/taskRoutes');
const trainingRequestRoutes = require('./routes/trainingRequestRoutes');
const expenseClaimRoutes = require('./routes/expenseClaimRoutes');
const systemSettingsRoutes = require('./routes/systemSettingsRoutes');
const connectDB = require('./config/db');
const { securityHeaders, loginLimiter } = require('./middleware/security');
const cookieParser = require('cookie-parser');
const askaiRoutes = require('./routes/askaiRoutes');
const roleRoutes = require('./routes/roleRoutes');
const path = require('path');
const mobileAuthRoutes = require('./routes/mobileAuth');
const usersRoutes = require('./routes/users');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy to get real client IP
app.set('trust proxy', true);

// Middleware
app.use(express.json());

// Define the correct upload directory, using the environment variable for production
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
console.log(`[Server] Serving static files from: ${UPLOAD_DIR}`);

// Serve uploaded files statically from the correct directory BEFORE security headers
app.use('/uploads', express.static(UPLOAD_DIR));

// Development and Production CORS settings
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.LIVE_FRONTEND_URL,
  'https://sbfront-7xef.onrender.com',
  'https://www.stfbridge.com' // Fallback for LIVE_FRONTEND_URL
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID']
};
app.use(cors(corsOptions));

// Security middleware
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Apply security middleware
securityHeaders.forEach(middleware => app.use(middleware));

// Basic middleware
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan('dev'));
app.use(cookieParser());

// Database connection
connectDB();

// Apply login rate limiter only to login route
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/bulletin', bulletinRoutes);
app.use('/api/performance-evaluations', performanceEvaluationRoutes);
app.use('/api/recognitions', peerRecognitionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/authorized-networks', authorizedNetworkRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/geofence-settings', geofenceSettingsRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/staff-profiles', staffProfileRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/training-requests', trainingRequestRoutes);
app.use('/api/expense-claims', expenseClaimRoutes);
app.use('/api', systemSettingsRoutes);
app.use('/api/ask-ai', askaiRoutes);
app.use('/api', roleRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/mobile', mobileAuthRoutes);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
}); 