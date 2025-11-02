const express = require('express');
const router = express.Router();
const performanceEvaluationController = require('../controllers/performanceEvaluationController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all performance evaluation routes
// Performance evaluations are available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('performance_evaluations'));

// Admin: Create a new evaluation
router.post('/', performanceEvaluationController.createEvaluation);
// Admin: Update an evaluation
router.put('/:id', performanceEvaluationController.updateEvaluation);
// Get evaluations (admin: all, staff: own)
router.get('/', permissions('Learning', 'view', 'Evaluation'), performanceEvaluationController.getEvaluations);
// Get a single evaluation
router.get('/:id', permissions('Learning', 'view', 'Evaluation'), performanceEvaluationController.getEvaluationById);
// Staff: Add a comment
router.post('/:id/comment', performanceEvaluationController.addStaffComment);

module.exports = router; 