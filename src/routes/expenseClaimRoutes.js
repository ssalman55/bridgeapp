const express = require('express');
const router = express.Router();
const expenseClaimController = require('../controllers/expenseClaimController');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
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

// Staff: Create or update claim (draft/submit)
router.post('/', authenticateToken, upload.array('receipts', 10), expenseClaimController.createOrUpdateClaim);
// Staff: List my claims
router.get('/my', authenticateToken, expenseClaimController.getMyClaims);
// Admin: List/filter all claims
router.get('/admin', authenticateToken, permissions('Expenses', 'view', 'Pending Claims'), expenseClaimController.getAllClaims);
// Admin: Approve/reject
router.patch('/:id/decision', authenticateToken, permissions('Expenses', 'full'), expenseClaimController.approveOrReject);
// Get claim by ID
router.get('/:id', authenticateToken, expenseClaimController.getClaimById);
// Delete claim by ID
router.delete('/:id', authenticateToken, expenseClaimController.deleteClaim);

module.exports = router; 