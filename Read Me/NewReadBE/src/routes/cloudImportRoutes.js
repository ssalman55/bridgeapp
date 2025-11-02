const express = require('express');
const router = express.Router();
const cloudImportController = require('../controllers/cloudImportController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { cloudImportLimiter } = require('../middleware/rateLimiter');

console.log('=== CLOUD IMPORT ROUTES LOADING ===');
console.log('Controller methods available:', Object.keys(cloudImportController));

/**
 * Cloud Import Routes
 * Handles file imports from cloud storage providers (OneDrive, Google Drive)
 */

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all cloud import routes
// Cloud imports are now available to all plans
router.use(checkSubscriptionStatus);

// Import file from cloud storage (rate limited) - authentication, subscription, and feature access already applied
router.post('/import', cloudImportLimiter, cloudImportController.importFile);

// Get cloud import configuration
router.get('/config', cloudImportController.getConfig);

// Update cloud import configuration
router.put('/config', cloudImportController.updateConfig);

// OneDrive authentication routes
router.post('/onedrive-auth-check', cloudImportController.checkOneDriveAuth);
router.post('/onedrive-consent-url', cloudImportController.getOneDriveConsentUrl);
router.post('/onedrive-token-exchange', cloudImportController.exchangeOneDriveToken);

// Test endpoint to verify routing
router.get('/test', (req, res) => {
  console.log('=== CLOUD IMPORT TEST ENDPOINT HIT ===');
  res.json({ message: 'Cloud import routes are working', timestamp: new Date().toISOString() });
});

console.log('=== CLOUD IMPORT ROUTES LOADED SUCCESSFULLY ===');
console.log('Routes registered:', [
  'POST /import',
  'GET /config', 
  'PUT /config',
  'POST /onedrive-auth-check',
  'POST /onedrive-consent-url',
  'POST /onedrive-token-exchange',
  'GET /test'
]);

module.exports = router;
