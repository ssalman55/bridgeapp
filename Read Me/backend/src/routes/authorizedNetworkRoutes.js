const express = require('express');
const router = express.Router();
const authorizedNetworkController = require('../controllers/authorizedNetworkController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// All routes require authentication
router.use(authenticateToken);

// Get all networks for the organization
router.get('/', authorizedNetworkController.getNetworks);

// Create a new network (admin only)
router.post('/', permissions('Settings', 'full', 'Geofence Management'), authorizedNetworkController.createNetwork);

// Update a network (admin only)
router.put('/:id', permissions('Settings', 'full', 'Geofence Management'), authorizedNetworkController.updateNetwork);

// Delete a network (admin only)
router.delete('/:id', permissions('Settings', 'full', 'Geofence Management'), authorizedNetworkController.deleteNetwork);

module.exports = router; 