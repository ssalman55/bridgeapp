const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// Get notifications for user (admin or staff)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ 
      recipient: userId,
      organization: req.user.organization 
    })
      .sort({ timestamp: -1 })
      .limit(20);
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// Mark notification as read
router.post('/read/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
      organization: req.user.organization
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ message: 'Failed to mark notification as read', error: err.message });
  }
});

// Mark all as read
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        recipient: req.user._id,
        organization: req.user.organization,
        read: false 
      },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: err.message });
  }
});

// Add unread count endpoint
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.organization;
    const count = await Notification.countDocuments({ recipient: userId, organization: orgId, read: false });
    res.json(count);
  } catch (err) {
    console.error('Error fetching notification count:', err);
    res.status(500).json({ message: 'Failed to fetch notification count', error: err.message });
  }
});

module.exports = router; 