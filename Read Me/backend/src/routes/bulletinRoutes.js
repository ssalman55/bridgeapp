const express = require('express');
const router = express.Router();
const bulletinController = require('../controllers/bulletinController');
const { protect, adminOrAcademicAdmin } = require('../middleware/authMiddleware');
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

// Admin & Academic Admin: Create post
router.post('/', protect, permissions('Bulletin Board', 'full', 'Bulletin Board'), upload.array('images', 10), bulletinController.createPost);
// Admin & Academic Admin: Update post
router.put('/:id', protect, permissions('Bulletin Board', 'full', 'Bulletin Board'), upload.array('images', 10), bulletinController.updatePost);
// Admin & Academic Admin: Delete post
router.delete('/:id', protect, permissions('Bulletin Board', 'full', 'Bulletin Board'), bulletinController.deletePost);
// All: List all posts
router.get('/', protect, bulletinController.getAllPosts);
// All: Get single post
router.get('/:id', protect, bulletinController.getPost);

module.exports = router; 