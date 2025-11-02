const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');

// Import controller
const {
  getLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation
} = require('../controllers/locationController');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all location routes
// Location settings are part of Geofencing features (Professional+)
router.use(checkSubscriptionStatus);
router.use(featureAccess('geofencing_attendance'));

// Location routes (authentication, subscription, and feature access already applied)
router.get('/', getLocations);
router.get('/:id', getLocation);
router.post('/', createLocation); // Need to check if we should add permissions
router.put('/:id', updateLocation); // Need to check if we should add permissions
router.delete('/:id', deleteLocation); // Need to check if we should add permissions

module.exports = router;





