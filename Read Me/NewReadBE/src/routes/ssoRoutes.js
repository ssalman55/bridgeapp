const express = require('express');
const router = express.Router();
const ssoController = require('../controllers/ssoController');
const { protect, admin } = require('../middleware/authMiddleware');

// Debug middleware to log all SSO route requests
router.use((req, res, next) => {
  console.log('=== SSO ROUTE REQUEST ===');
  console.log('SSO Route method:', req.method);
  console.log('SSO Route path:', req.path);
  console.log('SSO Route original URL:', req.originalUrl);
  console.log('SSO Route headers:', req.headers);
  next();
});

// Public routes (no authentication required)
router.post('/discover', ssoController.discoverOrganization);
router.post('/initiate', ssoController.initiateSSO);
router.get('/callback', ssoController.handleSSOCallback);
router.post('/break-glass-login', ssoController.breakGlassLogin);

// Protected routes (authentication required)
router.use(protect);

// SSO configuration management (admin only)
// More specific route first, then general route
router.get('/config/:organizationId', ssoController.getSSOConfig); // Support old SSO Configuration page (specific)
router.get('/config', ssoController.getSSOConfig); // New Teams integration route (general)
router.put('/config', admin, ssoController.updateSSOConfig);
router.post('/config/test-azure-connection', admin, ssoController.testAzureConnection);

// Teams integration configuration (admin only)
router.get('/teams/config', admin, ssoController.getTeamsConfig);

// Teams integration check (for all authenticated users)
router.get('/teams/integration-status', ssoController.checkTeamsIntegration);

// SSO session management
router.post('/refresh-token', protect, ssoController.refreshToken);
router.delete('/sessions/:sessionId', protect, ssoController.revokeSession);
router.get('/sessions', protect, ssoController.getUserSessions);

module.exports = router;
