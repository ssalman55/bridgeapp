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
  updateUser,
  updateProfileImage,
  getProfileImageUrl,
  uploadBannerImage,
  getBannerImageUrl,
  getLogoImageUrl,
  refreshToken
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/fileUpload');
const profileImageUpload = require('../middleware/profileImageUpload');
const bannerImageUpload = require('../middleware/bannerImageUpload');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithToken);

// Protected routes
router.get('/me', protect, getMe);
router.post('/refresh-token', protect, refreshToken);
router.post('/reset-password', protect, resetPassword);
router.post('/change-password', protect, changePassword);
router.patch('/profile', protect, updateProfile);

// Reset user password (admin only)
router.post('/reset-user-password', protect, admin, resetUserPassword);

// Update user (admin only)
router.put('/users/:id', protect, admin, updateUser);

// Profile image upload route
router.post('/profile/image', protect, profileImageUpload.single('profileImage'), updateProfileImage);

// Get signed URL for profile image
router.get('/profile-image/:s3Key', protect, getProfileImageUrl);

// Banner image upload route (admin only)
router.post('/banner/image', protect, admin, bannerImageUpload.single('bannerImage'), uploadBannerImage);

// Get signed URL for banner image
router.get('/banner-image/:s3Key', protect, getBannerImageUrl);

// Get signed URL for logo image
router.get('/logo-image/:s3Key', protect, getLogoImageUrl);

module.exports = router;
