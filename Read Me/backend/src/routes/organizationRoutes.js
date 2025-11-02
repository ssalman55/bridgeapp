const express = require('express');
const router = express.Router();
const { 
  registerOrganization,
  getOrganizationDetails,
  updateOrganization,
  getOrganizationStats,
  upgradeOrganization,
  getReceiptPDF
} = require('../controllers/organizationController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Public route for registering new organization
router.post('/register', registerOrganization);

// Protected routes (require authentication and admin-level permissions)
router.get('/details', authenticateToken, permissions('Settings', 'view', 'System Variables'), getOrganizationDetails);
router.put('/update', authenticateToken, permissions('Settings', 'full'), updateOrganization);
router.get('/stats', authenticateToken, permissions('Settings', 'view'), getOrganizationStats);
router.post('/upgrade', authenticateToken, permissions('Settings', 'full'), upgradeOrganization);
router.get('/receipt/:transactionId/pdf', authenticateToken, permissions('Settings', 'view'), getReceiptPDF);

module.exports = router; 