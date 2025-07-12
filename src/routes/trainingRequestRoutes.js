const express = require('express');
const router = express.Router();
const trainingRequestController = require('../controllers/trainingRequestController');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const permissions = require('../middleware/permissions');

// Ensure uploads/training directory exists
const trainingUploadDir = path.join(__dirname, '../../uploads/training');
if (!fs.existsSync(trainingUploadDir)) {
  fs.mkdirSync(trainingUploadDir, { recursive: true });
}

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, trainingUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Staff: Create or update (draft/submit)
router.post('/', authenticateToken, upload.single('attachment'), trainingRequestController.createOrUpdateRequest);
// Staff: Get my requests
router.get('/my', authenticateToken, trainingRequestController.getMyRequests);
// Admin: List all requests
router.get('/admin', authenticateToken, permissions('Training', 'view', 'Training Requests'), trainingRequestController.getAllRequests);
// Admin: Approve/reject
router.patch('/:id/decision', authenticateToken, permissions('Training', 'full'), trainingRequestController.approveOrReject);
// Admin: Approved requests
router.get('/admin/approved', authenticateToken, permissions('Training', 'view', 'Approved Trainings'), trainingRequestController.getApprovedRequests);
// Admin: Training cost summary
router.get('/admin/costs', authenticateToken, permissions('Training', 'full', 'Training Costs'), trainingRequestController.getTrainingCosts);
// Admin: Rejected requests
router.get('/admin/rejected', authenticateToken, permissions('Training', 'view', 'Rejected Trainings'), trainingRequestController.getRejectedRequests);
// Get request by ID
router.get('/:id', authenticateToken, trainingRequestController.getRequestById);
// Delete request by ID
router.delete('/:id', authenticateToken, trainingRequestController.deleteRequest);

module.exports = router; 