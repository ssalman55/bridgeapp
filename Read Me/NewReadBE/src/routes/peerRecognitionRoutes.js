const express = require('express');
const router = express.Router();
const {
  submitRecognition,
  listRecognitions,
  approveRecognition,
  rejectRecognition
} = require('../controllers/peerRecognitionController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all peer recognition routes
router.use(checkSubscriptionStatus);

// Staff: Submit recognition (authentication and subscription already applied)
router.post('/', submitRecognition);
// List recognitions (staff: approved only, admin: all)
router.get('/', listRecognitions);
// Admin: Approve
router.put('/:id/approve', approveRecognition);
// Admin: Reject
router.put('/:id/reject', rejectRecognition);

module.exports = router; 