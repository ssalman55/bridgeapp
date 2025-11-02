const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');
const timeout = require('../middleware/timeout');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all payroll routes
// Payroll is available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('payroll_processing'));

// Generate payroll for a month (with 5 minute timeout for large batches)
router.post('/generate', permissions('Payroll', 'full', 'Payroll Management'), timeout(300000), payrollController.generatePayroll);
// Get all payrolls (admin)
router.get('/', permissions('Payroll', 'view', 'Payroll Management'), payrollController.getPayrolls);
// Get payrolls for logged-in staff
router.get('/my', payrollController.getMyPayrolls);
// Get payroll audit logs
router.get('/audit', permissions('Payroll', 'view', 'Payroll Audit Trail'), payrollController.getPayrollAuditLogs);

// Get organizations for payroll file generation
router.post('/file-organizations', permissions('Payroll', 'view', 'Payroll Management'), payrollController.getOrganizations);

// Generate payroll file for download
router.post('/generate-file', permissions('Payroll', 'full', 'Generate Payroll File'), payrollController.generatePayrollFile);

// Download generated payroll file
router.get('/download/:fileName', permissions('Payroll', 'view', 'Generate Payroll File'), payrollController.downloadPayrollFile);

// Mark payroll as paid
router.patch('/:id/mark-paid', permissions('Payroll', 'full', 'Payroll Management'), payrollController.markAsPaid);
// Get payslip for a payroll
router.get('/:id/payslip', payrollController.getPayslip);
// Get payslip PDF for a payroll
router.get('/:id/payslip/pdf', payrollController.getPayslipPDF);

// Debug route to check if router is alive
router.get('/test-alive', (req, res) => res.json({ ok: true }));

module.exports = router; 