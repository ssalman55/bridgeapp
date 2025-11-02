const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cors = require('cors');
const express = require('express');

// Create limiter for login attempts - More lenient for development
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 login requests per minute
  message: {
    status: 'error',
    message: 'Too many login attempts, please try again after 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter - More lenient for development
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Limit each IP to 1000 requests per minute
  message: {
    status: 'error',
    message: 'Too many requests, please try again after 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS options
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://sbfront-7xef.onrender.com',
    'https://backend-y16q.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Security headers middleware using helmet
const securityHeaders = [
  // Basic security with helmet
  helmet(),
  
  // Content Security Policy
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://sbfront-7xef.onrender.com", "https://backend-y16q.onrender.com", "*"],
      connectSrc: ["'self'", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "https://sbfront-7xef.onrender.com", "https://backend-y16q.onrender.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    },
  }),
  
  // Additional helmet configurations
  helmet.dnsPrefetchControl({ allow: false }),
  helmet.frameguard({ action: 'sameorigin' }),
  helmet.hidePoweredBy(),
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }),
  helmet.ieNoOpen(),
  helmet.noSniff(),
  helmet.permittedCrossDomainPolicies(),
  helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }),
  helmet.xssFilter(),
  
  // CORS configuration
  cors(corsOptions),
  
  // Prevent HTTP Parameter Pollution attacks
  hpp({
    whitelist: [
      'sort', 'page', 'limit', 'fields',
      'startDate', 'endDate',
      'status', 'role', 'department'
    ]
  }),
  
  // Sanitize data against NoSQL query injection
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`This request[${key}] is sanitized`, req.originalUrl);
    }
  }),
  
  // Prevent XSS attacks
  xss(),
];

module.exports = {
  loginLimiter,
  apiLimiter,
  securityHeaders
}; 