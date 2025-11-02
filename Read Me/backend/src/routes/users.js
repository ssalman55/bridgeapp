const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get all users (staff directory, any authenticated user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, authorizeAdmin, async (req, res) => {
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