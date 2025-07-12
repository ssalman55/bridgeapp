const express = require('express');
const { 
  register, 
  login, 
  getCurrentUser, 
  resetPassword, 
  getMe, 
  changePassword, 
  resetPasswordWithToken,
  resetUserPassword,
  forgotPassword,
  updateProfile,
  updateProfileImage
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/fileUpload');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithToken);

// Protected routes
router.get('/me', protect, getMe);
router.post('/reset-password', protect, resetPassword);
router.post('/change-password', protect, changePassword);
router.patch('/profile', protect, updateProfile);

// Reset user password (admin only)
router.post('/reset-user-password', protect, admin, resetUserPassword);

// Profile image upload route
router.post('/profile/image', protect, upload.single('profileImage'), updateProfileImage);

module.exports = router; 