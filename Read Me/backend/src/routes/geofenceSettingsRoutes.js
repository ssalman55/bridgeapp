const express = require('express');
const router = express.Router();
const geofenceSettingsController = require('../controllers/geofenceSettingsController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes require authentication and admin role
router.get('/', protect, admin, geofenceSettingsController.getSettings);
router.put('/', protect, admin, geofenceSettingsController.updateSettings);

module.exports = router; 