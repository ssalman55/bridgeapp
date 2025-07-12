const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const upload = require('../middleware/fileUpload');
const { protect, admin } = require('../middleware/authMiddleware');
const Document = require('../models/Document');

// Staff role middleware
const staff = (req, res, next) => {
  if (req.user && req.user.role === 'staff') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as staff' });
  }
};

// Allow both staff and admin to upload documents
router.post('/upload', protect, upload.single('file'), fileController.uploadFile);

// Admin: List all files
// router.get('/', protect, admin, fileController.getAllFiles);

// Admin: Download file
// router.get('/:id/download', protect, admin, fileController.downloadFile);

// Admin: Delete file
// router.delete('/:id', protect, admin, fileController.deleteFile);

module.exports = router; 