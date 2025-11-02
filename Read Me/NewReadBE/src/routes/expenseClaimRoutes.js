const express = require('express');
const router = express.Router();
const expenseClaimController = require('../controllers/expenseClaimController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const permissions = require('../middleware/permissions');

// Ensure uploads/expense-claims directory exists
const expenseUploadDir = path.join(__dirname, '../../uploads/expense-claims');
if (!fs.existsSync(expenseUploadDir)) {
  fs.mkdirSync(expenseUploadDir, { recursive: true });
}

// Multer setup for file upload (multiple receipts)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, expenseUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all expense claim routes
// Expense management is available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('expense_management'));

// Staff: Create or update claim (draft/submit)
router.post('/', upload.array('receipts', 10), expenseClaimController.createOrUpdateClaim);
// Staff: List my claims
router.get('/my', expenseClaimController.getMyClaims);
// Admin: List/filter all claims
router.get('/admin', permissions('Expenses', 'view', 'Pending Claims'), expenseClaimController.getAllClaims);
// Admin: Approve/reject
router.patch('/:id/decision', permissions('Expenses', 'full'), expenseClaimController.approveOrReject);
// Get claim by ID
router.get('/:id', expenseClaimController.getClaimById);
// Delete claim by ID
router.delete('/:id', expenseClaimController.deleteClaim);

module.exports = router; 