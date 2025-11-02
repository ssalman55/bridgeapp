const express = require('express');
const router = express.Router();
const bulletinController = require('../controllers/bulletinController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const multer = require('multer');
const path = require('path');
const permissions = require('../middleware/permissions');

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/bulletin'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage });

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(protect);

// Apply subscription middleware to all bulletin routes
router.use(checkSubscriptionStatus);

// Create post (authentication and subscription already applied)
router.post('/', permissions('Communication', 'full', 'Bulletin Board'), upload.array('images', 10), bulletinController.createPost);
// Update post
router.put('/:id', permissions('Communication', 'full', 'Bulletin Board'), upload.array('images', 10), bulletinController.updatePost);
// Delete post
router.delete('/:id', permissions('Communication', 'full', 'Bulletin Board'), bulletinController.deletePost);
// List all posts
router.get('/', permissions('Communication', 'view', 'Bulletin Board'), bulletinController.getAllPosts);
// Get single post
router.get('/:id', permissions('Communication', 'view', 'Bulletin Board'), bulletinController.getPost);

module.exports = router; 