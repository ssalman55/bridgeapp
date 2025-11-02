const express = require('express');
const router = express.Router();
const { 
  generateCustomReport, 
  exportReport, 
  saveReport, 
  getSavedReports, 
  downloadSavedReport, 
  deleteSavedReport, 
  getSavedReportDetails 
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(protect);

// Apply subscription middleware to all report routes
router.use(checkSubscriptionStatus);

// POST /api/reports/custom (authentication and subscription already applied)
router.post('/custom', generateCustomReport);

// POST /api/reports/export
router.post('/export', exportReport);

// POST /api/reports/save
router.post('/save', saveReport);

// GET /api/reports/saved
router.get('/saved', getSavedReports);

// GET /api/reports/saved/:reportId
router.get('/saved/:reportId', getSavedReportDetails);

// GET /api/reports/saved/:reportId/download
router.get('/saved/:reportId/download', downloadSavedReport);

// DELETE /api/reports/saved/:reportId
router.delete('/saved/:reportId', deleteSavedReport);

module.exports = router; 