const express = require('express');
const router = express.Router();
const geofenceSettingsController = require('../controllers/geofenceSettingsController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(protect);

// Geofencing settings are available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('geofencing_attendance'));

// All routes require appropriate permissions
router.get('/', permissions('Admin', 'view', 'Geofence Settings'), geofenceSettingsController.getSettings);
router.put('/', permissions('Admin', 'full', 'Geofence Settings'), geofenceSettingsController.updateSettings);

module.exports = router; 