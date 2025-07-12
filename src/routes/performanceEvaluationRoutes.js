const express = require('express');
const router = express.Router();
const {
  createEvaluation,
  updateEvaluation,
  getEvaluations,
  getEvaluationById,
  addStaffComment
} = require('../controllers/performanceEvaluationController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// All routes require authentication
router.use(authenticateToken);

// Admin: Create a new evaluation
router.post('/', createEvaluation);
// Admin: Update an evaluation
router.put('/:id', updateEvaluation);
// Get evaluations (admin: all, staff: own)
router.get('/', permissions('Evaluation', 'view', 'Performance Evaluation'), getEvaluations);
// Get a single evaluation
router.get('/:id', permissions('Evaluation', 'view', 'Performance Evaluation'), getEvaluationById);
// Staff: Add a comment
router.post('/:id/comment', addStaffComment);

module.exports = router; 