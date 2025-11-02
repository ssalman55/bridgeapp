const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');
const enhancedPayrollController = require('../controllers/enhancedPayrollController');

/**
 * Enhanced Payroll Routes with WPS Support
 * Extends existing payroll functionality with WPS compliance features
 */

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all enhanced payroll routes
router.use(checkSubscriptionStatus);

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Enhanced payroll router is working!' });
});

// WPS-specific routes (authentication and subscription already applied)
router.post('/generate-wps-file', 
  (req, res, next) => {
    console.log('[WPS Route] POST /generate-wps-file hit!');
    next();
  },
  permissions('Payroll', 'full'), 
  enhancedPayrollController.generateWPSFile.bind(enhancedPayrollController)
);

router.get('/wps-countries', 
  permissions('Payroll', 'view'), 
  enhancedPayrollController.getWPSCountries.bind(enhancedPayrollController)
);

router.get('/bank-presets/:country', 
  permissions('Payroll', 'view'), 
  enhancedPayrollController.getBankPresets.bind(enhancedPayrollController)
);

router.get('/run-history/:organizationId', 
  permissions('Payroll', 'view'), 
  enhancedPayrollController.getPayrollRunHistory.bind(enhancedPayrollController)
);

router.get('/download/:runId', 
  permissions('Payroll', 'view'), 
  enhancedPayrollController.downloadPayrollFile.bind(enhancedPayrollController)
);

module.exports = router;
