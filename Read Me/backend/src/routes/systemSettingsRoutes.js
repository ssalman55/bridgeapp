const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const permissions = require('../middleware/permissions');

router.get('/settings', authenticateToken, permissions('Settings', 'view', 'System Variables'), systemSettingsController.getSettings);
router.put('/settings', authenticateToken, permissions('Settings', 'full', 'System Variables'), systemSettingsController.updateSettings);

module.exports = router; 