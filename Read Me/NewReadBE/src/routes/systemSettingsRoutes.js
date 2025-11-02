const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware (no feature restriction - available to all plans)
router.use(checkSubscriptionStatus);

// System settings routes (authentication and subscription already applied)
router.get('/settings', permissions('Admin', 'view', 'System Variables'), systemSettingsController.getSettings);
router.put('/settings', permissions('Admin', 'full', 'System Variables'), systemSettingsController.updateSettings);

module.exports = router; 