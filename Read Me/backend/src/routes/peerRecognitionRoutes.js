const express = require('express');
const router = express.Router();
const {
  submitRecognition,
  listRecognitions,
  approveRecognition,
  rejectRecognition
} = require('../controllers/peerRecognitionController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Staff: Submit recognition
router.post('/', submitRecognition);
// List recognitions (staff: approved only, admin: all)
router.get('/', listRecognitions);
// Admin: Approve
router.put('/:id/approve', approveRecognition);
// Admin: Reject
router.put('/:id/reject', rejectRecognition);

module.exports = router; 