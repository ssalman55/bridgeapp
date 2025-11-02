const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');
const User = require('../models/User');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all user routes
router.use(checkSubscriptionStatus);

// Get all users (admin only) (authentication and subscription already applied)
router.get('/', permissions('People', 'view', 'Profiles'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Create new user (admin only)
router.post('/', permissions('People', 'full', 'Create'), async (req, res) => {
  try {
    const { fullName, email, password, department, position, role } = req.body;
    const user = await User.create({
      fullName,
      email,
      password,
      department,
      position,
      role: role || 'staff'
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 