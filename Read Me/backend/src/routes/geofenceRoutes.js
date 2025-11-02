const express = require('express');
const router = express.Router();
const geofenceController = require('../controllers/geofenceController');
const { protect, admin } = require('../middleware/authMiddleware');
const permissions = require('../middleware/permissions');

// All routes require authentication and admin role
router.post('/', protect, admin, geofenceController.createGeofence);
router.get('/', protect, permissions('Settings', 'view', 'Geofence Management'), geofenceController.getGeofences);
router.put('/:id', protect, admin, geofenceController.updateGeofence);
router.delete('/:id', protect, admin, geofenceController.deleteGeofence);

module.exports = router; 