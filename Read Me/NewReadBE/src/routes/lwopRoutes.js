const express = require('express');
const router = express.Router();
const lwopController = require('../controllers/lwopController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply authentication to all routes
router.use(authenticateToken);

// Generate LWOP Threshold Report for a given pay period
// @route   POST /api/lwop/reports/generate
// @access  Private (Admin/HR)
router.post('/reports/generate', 
  permissions('Payroll', 'full', 'LWOP Management'), 
  lwopController.generateLWOPReport
);

// Get LWOP reports with filters
// @route   GET /api/lwop/reports
// @access  Private (Admin/HR)
router.get('/reports', 
  permissions('Payroll', 'view', 'LWOP Management'), 
  lwopController.getLWOPReports
);

// Get LWOP report summary statistics
// @route   GET /api/lwop/summary
// @access  Private (Admin/HR)
router.get('/summary', 
  permissions('Payroll', 'view', 'LWOP Management'), 
  lwopController.getLWOPSummary
);

// Export LWOP report to Excel
// @route   GET /api/lwop/reports/export
// @access  Private (Admin/HR)
router.get('/reports/export', 
  permissions('Payroll', 'view', 'LWOP Management'), 
  lwopController.exportLWOPReport
);

// Post LWOP deduction to payroll (bulk action)
// @route   POST /api/lwop/deductions/post
// @access  Private (Admin/HR)
router.post('/deductions/post', 
  permissions('Payroll', 'full', 'LWOP Management'), 
  lwopController.postLWOPDeduction
);

// Ignore LWOP deduction (bulk action)
// @route   POST /api/lwop/deductions/ignore
// @access  Private (Admin/HR)
router.post('/deductions/ignore', 
  permissions('Payroll', 'full', 'LWOP Management'), 
  lwopController.ignoreLWOPDeduction
);

// Override LWOP deduction amount (bulk action)
// @route   POST /api/lwop/deductions/override
// @access  Private (Admin/HR)
router.post('/deductions/override', 
  permissions('Payroll', 'full', 'LWOP Management'), 
  lwopController.overrideLWOPDeduction
);

// Get document download URL for leave request attachment
// @route   GET /api/lwop/reports/:reportId/documents/:attachmentIndex/download
// @access  Private (Admin/HR)
router.get('/reports/:reportId/documents/:attachmentIndex/download', 
  permissions('Payroll', 'view', 'LWOP Management'), 
  lwopController.getDocumentDownloadUrl
);

module.exports = router;










