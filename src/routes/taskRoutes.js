const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const permissions = require('../middleware/permissions');
const { getSignedUrl } = require('../utils/s3');
const Task = require('../models/Task');

// Multer setup for S3: use memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Admin: Create task
router.post('/', authenticateToken, authorizeAdmin, upload.single('attachment'), taskController.createTask);
// Admin: View all tasks
router.get('/admin', authenticateToken, permissions('Tasks', 'view', 'View Tasks'), taskController.getTasksForAdmin);
// Staff: View my tasks
router.get('/staff', authenticateToken, taskController.getTasksForStaff);
// Get task details
router.get('/:id', authenticateToken, taskController.getTaskById);
// Staff: Update task status
router.patch('/:id/status', authenticateToken, taskController.updateTaskStatus);
// Admin: Revert completed task to in progress with note
router.patch('/:id/revert', authenticateToken, authorizeAdmin, taskController.revertTaskToInProgress);
// Add this route for signed attachment download
router.get('/attachment/:taskId', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || !task.attachment || !task.attachment.url) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    // Robust S3 key extraction
    let key;
    if (task.attachment.url.startsWith('http')) {
      const match = task.attachment.url.match(/amazonaws\.com\/(.+)$/);
      key = match ? match[1] : null;
    } else {
      key = task.attachment.url.replace(/^\/uploads\//, '');
    }
    if (!key) {
      console.error('Attachment S3 key extraction failed:', task.attachment.url);
      return res.status(400).json({ message: 'Invalid attachment URL' });
    }
    const signedUrl = getSignedUrl(key);
    res.json({ url: signedUrl });
  } catch (err) {
    console.error('Task attachment signed URL error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 