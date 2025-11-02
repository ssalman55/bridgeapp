const express = require('express');
const router = express.Router();
const {
  getLeaveTypes,
  getActiveLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeaveBalance,
  getUserLeaveBalances,
  getCurrentUserLeaveBalances
} = require('../controllers/leaveTypeController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all leave type routes
router.use(checkSubscriptionStatus);

// Admin routes (require admin permissions)
router.get('/', permissions('Admin', 'view', 'Leave Settings'), getLeaveTypes);
router.post('/', permissions('Admin', 'full', 'Leave Settings'), createLeaveType);
router.put('/:id', permissions('Admin', 'full', 'Leave Settings'), updateLeaveType);
router.delete('/:id', permissions('Admin', 'full', 'Leave Settings'), deleteLeaveType);

// Staff routes (accessible to all authenticated users)
router.get('/active', getActiveLeaveTypes);
router.get('/balance/:userId/:leaveTypeId', getLeaveBalance);
router.get('/balance/:userId', getUserLeaveBalances);
router.get('/user-balances', getCurrentUserLeaveBalances);

module.exports = router;
