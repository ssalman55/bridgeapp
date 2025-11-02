const express = require('express');
const router = express.Router();
const headOfficeController = require('../controllers/headOfficeController');
const { authenticateToken } = require('../middleware/auth');
const timeout = require('../middleware/timeout');

// Check if user has head office access
router.get('/access', authenticateToken, headOfficeController.checkHeadOfficeAccess);

// Get head office dashboard data (with 30 second timeout)
router.get('/dashboard', authenticateToken, timeout(30000), headOfficeController.getHeadOfficeDashboard);

// Get linked branches for head office
router.get('/branches', authenticateToken, headOfficeController.getLinkedBranches);

// Clear dashboard cache (for debugging)
router.post('/clear-cache', authenticateToken, headOfficeController.clearDashboardCache);

module.exports = router;


