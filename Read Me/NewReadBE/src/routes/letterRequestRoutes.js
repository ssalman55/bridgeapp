const express = require('express');
const router = express.Router();
const letterRequestController = require('../controllers/letterRequestController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// @route   GET /api/letter-requests/stats
// @desc    Get letter request statistics
// @access  Private (All authenticated users)
router.get('/stats', 
  authenticateToken, 
  letterRequestController.getLetterRequestStats
);

// @route   GET /api/letter-requests/my
// @desc    Get current user's letter requests (staff view)
// @access  Private (All authenticated users)
router.get('/my', 
  authenticateToken, 
  letterRequestController.getMyLetterRequests
);

// @route   GET /api/letter-requests
// @desc    Get all letter requests (admin view)
// @access  Private (Admin with 'view' access)
router.get('/', 
  authenticateToken, 
  letterRequestController.getLetterRequests
);

// @route   POST /api/letter-requests
// @desc    Create a new letter request
// @access  Private (All authenticated users)
router.post('/', 
  authenticateToken, 
  letterRequestController.createLetterRequest
);

// @route   POST /api/letter-requests/:id/approve
// @desc    Approve a letter request
// @access  Private (Admin with 'full' access)
router.post('/:id/approve', 
  authenticateToken, 
  letterRequestController.approveLetterRequest
);

// @route   POST /api/letter-requests/:id/reject
// @desc    Reject a letter request
// @access  Private (Admin with 'full' access)
router.post('/:id/reject', 
  authenticateToken, 
  letterRequestController.rejectLetterRequest
);

// @route   GET /api/letter-requests/:id/download
// @desc    Download letter document
// @access  Private (Admin with 'view' access, Staff can download their own)
router.get('/:id/download', 
  authenticateToken, 
  letterRequestController.downloadLetterDocument
);

// @route   GET /api/letter-requests/:id
// @desc    Get a single letter request by ID
// @access  Private (Admin with 'view' access, Staff can view their own)
// NOTE: This must come LAST because /:id will match any path
router.get('/:id', 
  authenticateToken, 
  letterRequestController.getLetterRequestById
);

module.exports = router;
