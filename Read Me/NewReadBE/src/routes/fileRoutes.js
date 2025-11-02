const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const upload = require('../middleware/fileUpload');
const { protect, admin } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const Document = require('../models/Document');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// Staff role middleware
const staffOnly = (req, res, next) => {
  if (req.user && req.user.role === 'staff') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as staff' });
  }
};

// All routes require authentication
router.use(protect);

// Apply subscription middleware to all file routes
router.use(checkSubscriptionStatus);

// Allow both staff and admin to upload documents (authentication and subscription already applied)
router.post('/upload', upload.single('file'), fileController.uploadFile);

// Admin: List all files
// router.get('/', protect, admin, fileController.getAllFiles);

// Admin: Download file
// router.get('/:id/download', protect, admin, fileController.downloadFile);

// Admin: Delete file
// router.delete('/:id', protect, admin, fileController.deleteFile);

module.exports = router; 