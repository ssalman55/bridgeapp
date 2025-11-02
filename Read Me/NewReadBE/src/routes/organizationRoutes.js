const express = require('express');
const router = express.Router();
const { 
  registerOrganization,
  getOrganizationDetails,
  updateOrganization,
  getOrganizationStats,
  upgradeOrganization,
  getReceiptPDF,
  getSubscriptionStatus
} = require('../controllers/organizationController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// Public route for registering new organization
router.post('/register', registerOrganization);

// IMPORTANT: Middleware order matters for protected routes below
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// Protected routes (require authentication and admin-level permissions)
// Note: Some routes below have authentication without subscription to support billing operations
router.get('/details', authenticateToken, permissions('Admin', 'view', 'System Variables'), getOrganizationDetails);
router.put('/update', authenticateToken, permissions('Admin', 'full', 'System Variables'), updateOrganization);
router.get('/stats', authenticateToken, permissions('Admin', 'view', 'System Variables'), getOrganizationStats);
router.post('/upgrade', authenticateToken, permissions('Admin', 'full', 'System Variables'), upgradeOrganization);
router.get('/receipt/:transactionId/pdf', authenticateToken, permissions('Admin', 'view', 'System Variables'), getReceiptPDF);

// Subscription status route (requires authentication but no specific permissions or subscription check)
router.get('/subscription-status/:organizationId', authenticateToken, getSubscriptionStatus);

module.exports = router; 