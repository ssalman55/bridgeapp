const express = require('express');
const router = express.Router();
const staffProfileController = require('../controllers/staffProfileController');
const { authenticateToken } = require('../middleware/authMiddleware');
const permissions = require('../middleware/permissions');

// Staff: Get and update their own profile
router.get('/me', authenticateToken, staffProfileController.getMyProfile);
router.put('/me', authenticateToken, staffProfileController.updateMyProfile);

// Admin: Get all profiles, search, paginate
router.get('/', authenticateToken, permissions('Staff Management', 'view', 'Staff Profiles'), staffProfileController.getAllProfiles);
// Admin: Get profile by profileId
router.get('/:id', authenticateToken, permissions('Staff Management', 'view', 'Staff Profiles'), staffProfileController.getProfileById);
// Admin: Export all profiles (CSV/Excel placeholder)
router.get('/export/all', authenticateToken, permissions('Staff Management', 'view', 'Staff Profiles'), staffProfileController.exportProfiles);

module.exports = router; 