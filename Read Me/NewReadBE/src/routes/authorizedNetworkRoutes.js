const express = require('express');
const router = express.Router();
const authorizedNetworkController = require('../controllers/authorizedNetworkController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all network routes
// Security & Networks require Professional plan for Geofencing features
router.use(checkSubscriptionStatus);
router.use(featureAccess('geofencing_attendance'));

// Get all networks for the organization (authentication, subscription, and feature access already applied)
router.get('/', permissions('Admin', 'view', 'Geofence Settings'), authorizedNetworkController.getNetworks);

// Create a new network (admin only)
router.post('/', permissions('Admin', 'full', 'Geofence Settings'), authorizedNetworkController.createNetwork);

// Update a network (admin only)
router.put('/:id', permissions('Admin', 'full', 'Geofence Settings'), authorizedNetworkController.updateNetwork);

// Delete a network (admin only)
router.delete('/:id', permissions('Admin', 'full', 'Geofence Settings'), authorizedNetworkController.deleteNetwork);

module.exports = router; 