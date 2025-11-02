const express = require('express');
const router = express.Router();
const geofenceController = require('../controllers/geofenceController');
const { protect, admin } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(protect);

// Geofencing is available for Professional and Enterprise plans only
// Basic plan users can still use manual attendance, but cannot manage geofences
router.use(checkSubscriptionStatus);
router.use(featureAccess('geofencing_attendance'));

// All routes require admin role or appropriate permissions
router.post('/', admin, geofenceController.createGeofence);
router.get('/', permissions('Admin', 'view', 'Create Geofence'), geofenceController.getGeofences);
router.put('/:id', admin, geofenceController.updateGeofence);
router.delete('/:id', admin, geofenceController.deleteGeofence);

module.exports = router; 