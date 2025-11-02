const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const multer = require('multer');
const permissions = require('../middleware/permissions');
const { getSignedUrl } = require('../utils/s3');
const Task = require('../models/Task');

// Multer setup for S3: use memory storage
const upload = multer({ storage: multer.memoryStorage() });

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all task routes
// Task management is available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('task_management'));

// Create task (authentication, subscription, and feature access already applied)
router.post('/', permissions('People', 'full', 'Assign a Task'), upload.single('attachment'), taskController.createTask);
// View all tasks
router.get('/admin', permissions('People', 'view', 'View Tasks'), taskController.getTasksForAdmin);
// View my tasks
router.get('/staff', taskController.getTasksForStaff);
// Get task details
router.get('/:id', taskController.getTaskById);
// Update task status
router.patch('/:id/status', taskController.updateTaskStatus);
// Revert completed task to in progress with note
router.patch('/:id/revert', permissions('People', 'full', 'View Tasks'), taskController.revertTaskToInProgress);
// Add this route for signed attachment download
router.get('/attachment/:taskId', async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    console.log('Task found:', { 
      taskId: req.params.taskId, 
      hasAttachment: !!task?.attachment, 
      attachmentUrl: task?.attachment?.url 
    });
    
    if (!task || !task.attachment || !task.attachment.url) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    // Robust S3 key extraction
    let key;
    if (task.attachment.url.startsWith('http')) {
      // Handle S3 URLs with proper decoding
      const url = new URL(task.attachment.url);
      const pathParts = url.pathname.split('/');
      // Remove the first empty element and get the rest
      key = pathParts.slice(1).join('/');
      // Decode URL-encoded characters
      key = decodeURIComponent(key);
    } else {
      // Handle local file paths
      key = task.attachment.url.replace(/^\/uploads\//, '');
    }
    
    if (!key) {
      console.error('Attachment S3 key extraction failed:', task.attachment.url);
      return res.status(400).json({ message: 'Invalid attachment URL' });
    }
    
    console.log('Extracted S3 key:', key);
    const signedUrl = getSignedUrl(key);
    console.log('Generated signed URL:', signedUrl);
    res.json({ url: signedUrl });
  } catch (err) {
    console.error('Task attachment signed URL error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 