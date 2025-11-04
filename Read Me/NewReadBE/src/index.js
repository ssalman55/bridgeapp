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
const usersRoutes = require('./routes/users');
const taskRoutes = require('./routes/taskRoutes');
const trainingRequestRoutes = require('./routes/trainingRequestRoutes');
const expenseClaimRoutes = require('./routes/expenseClaimRoutes');
const systemSettingsRoutes = require('./routes/systemSettingsRoutes');
const connectDB = require('./config/db');
const { securityHeaders, loginLimiter } = require('./middleware/security');
const { checkSubscriptionStatus } = require('./middleware/subscriptionMiddleware');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const askaiRoutes = require('./routes/askaiRoutes');
const roleRoutes = require('./routes/roleRoutes');
const bankDetailsRoutes = require('./routes/bankDetailsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const ssoRoutes = require('./routes/ssoRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const locationRoutes = require('./routes/locationRoutes');
const helpdeskRoutes = require('./routes/helpdeskRoutes');
const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
const leaveAttachmentRoutes = require('./routes/leaveAttachmentRoutes');
const lwopRoutes = require('./routes/lwopRoutes');
const organizationDocumentRoutes = require('./routes/organizationDocumentRoutes');
const letterCategoryRoutes = require('./routes/letterCategoryRoutes');
const letterTemplateRoutes = require('./routes/letterTemplateRoutes');
const letterRequestRoutes = require('./routes/letterRequestRoutes');
const headOfficeRoutes = require('./routes/headOfficeRoutes');
const enhancedPayrollRoutes = require('./routes/enhancedPayrollRoutes');
const cloudImportRoutes = require('./routes/cloudImportRoutes');
console.log('=== MAIN SERVER: cloudImportRoutes loaded ===');
const contactRoutes = require('./routes/contactRoutes');
const mobileAuthRoutes = require('./routes/mobileAuth');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy to get real client IP
app.set('trust proxy', true);

// Middleware - Set larger limits for file uploads
app.use(express.json({ limit: '50mb' }));

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

// Basic middleware - Set larger limits for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use(cookieParser());

// Database connection
connectDB();

// Session configuration for SSO (using memory store for now)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  // Using memory store for now - sessions will be lost on server restart
  // TODO: Implement persistent MongoDB store once connection issues are resolved
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Apply login rate limiter only to login route
app.use('/api/auth/login', loginLimiter);

// Apply global subscription middleware to all API routes except auth, billing, and SSO
app.use('/api', (req, res, next) => {
  // Skip subscription check for auth routes, billing/payment routes, and SSO routes
  const skipRoutes = [
    '/auth',
    '/stripe', 
    '/payments',
    '/organization/subscription-status',
    '/enhanced-payroll', // Temporarily skip for debugging WPS
    '/contact-sales',
    '/health',
    '/sso' // CRITICAL: SSO routes must be skipped as they handle authentication before subscription check
  ];
  
  // Debug logging
  console.log(`[Subscription Middleware] Path: ${req.path}, Method: ${req.method}`);
  
  if (skipRoutes.some(route => req.path.startsWith(route))) {
    console.log(`[Subscription Middleware] Skipping subscription check for: ${req.path}`);
    return next();
  }
  
  console.log(`[Subscription Middleware] Applying subscription check for: ${req.path}`);
  // Apply subscription middleware to all other routes
  return checkSubscriptionStatus(req, res, next);
});

// Routes
// IMPORTANT: Register /api/mobile BEFORE any catch-all /api routes to avoid middleware conflicts
app.use('/api/mobile', mobileAuthRoutes);

// IMPORTANT: Register SSO routes EARLY to avoid catch-all route conflicts
app.use('/api/sso', (req, res, next) => {
  console.log(`[INDEX] SSO route matched: ${req.method} ${req.originalUrl}`);
  console.log(`[INDEX] SSO route path: ${req.path}`);
  console.log(`[INDEX] SSO route query:`, req.query);
  console.log(`[INDEX] SSO route has code:`, !!req.query?.code);
  console.log(`[INDEX] SSO route has state:`, !!req.query?.state);
  next();
}, ssoRoutes);

app.use('/api/auth', authRoutes);
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
app.use('/api/users', usersRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/training-requests', trainingRequestRoutes);
app.use('/api/expense-claims', expenseClaimRoutes);
app.use('/api', systemSettingsRoutes);
app.use('/api/ask-ai', askaiRoutes);
app.use('/api', roleRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stripe', stripeRoutes);
// SSO routes moved earlier to avoid catch-all route conflicts (see line 175)
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/staff-profiles', staffProfileRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/leave-attachments', leaveAttachmentRoutes);
app.use('/api/lwop', lwopRoutes);
app.use('/api/organization-documents', organizationDocumentRoutes);
app.use('/api/cloud-import', cloudImportRoutes);
console.log('=== MAIN SERVER: /api/cloud-import routes registered ===');
app.use('/api', contactRoutes);
app.use('/api/letter-categories', letterCategoryRoutes);
app.use('/api/letter-templates', letterTemplateRoutes);
app.use('/api/letter-requests', letterRequestRoutes);
app.use('/api/head-office', headOfficeRoutes);
app.use('/api/enhanced-payroll', enhancedPayrollRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));

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
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);}); 
