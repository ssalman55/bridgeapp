const express = require('express');
const router = express.Router();
const staffProfileController = require('../controllers/staffProfileController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all staff profile routes
router.use(checkSubscriptionStatus);

// Staff: Get and update their own profile (authentication and subscription already applied)
router.get('/me', staffProfileController.getMyProfile);
router.put('/me', staffProfileController.updateMyProfile);

// Admin: Get all profiles, search, paginate
router.get('/', permissions('People', 'view', 'Profiles'), staffProfileController.getAllProfiles);
// Admin: Get profile by profileId
router.get('/:id', permissions('People', 'view', 'Profiles'), staffProfileController.getProfileById);
// Admin: Export all profiles (CSV/Excel placeholder)
router.get('/export/all', permissions('People', 'view', 'Profiles'), staffProfileController.exportProfiles);

module.exports = router; 