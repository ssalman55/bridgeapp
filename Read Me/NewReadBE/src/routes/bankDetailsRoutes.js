const express = require('express');
const router = express.Router();
const bankDetailsController = require('../controllers/bankDetailsController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all bank details routes
router.use(checkSubscriptionStatus);

// Create or update bank details (staff can update their own, admin can update any)
router.post('/', bankDetailsController.createOrUpdateBankDetails);

// Get bank details for all staff (admin only)
router.get('/', permissions('Salary', 'view', 'Bank Details'), bankDetailsController.getBankDetails);

// Get bank details for a specific staff member
router.get('/staff/:staff_id', bankDetailsController.getStaffBankDetails);

// Verify bank details (admin only)
router.put('/:id/verify', permissions('Salary', 'full', 'Bank Details'), bankDetailsController.verifyBankDetails);

// Delete bank details (admin only)
router.delete('/:id', permissions('Salary', 'full', 'Bank Details'), bankDetailsController.deleteBankDetails);

// Export bank details for payroll processing (admin only)
router.get('/export', permissions('Salary', 'view', 'Bank Details'), bankDetailsController.exportBankDetails);

module.exports = router; 