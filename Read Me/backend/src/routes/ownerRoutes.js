const express = require('express');
const router = express.Router();
const ownerOnly = require('../middleware/ownerOnly');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const ContactMessage = require('../models/ContactMessage');
const { getConfig, saveOrUpdateConfig, testConnection } = require('../controllers/ownerController');

// Example: Get platform metrics (total orgs, breakdown by plan, etc.)
router.get('/metrics', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const totalOrgs = await Organization.countDocuments();
    const plans = await Organization.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    const totalUsers = await User.countDocuments();
    res.json({ totalOrgs, plans, totalUsers });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching metrics', error: err.message });
  }
});

// Get organization registrations by month (last 12 months)
router.get('/registrations-by-month', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1); // 12 months ago, start of month

    // Aggregate organizations by month
    const registrations = await Organization.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Format result as [{ month: 'Jan 24', count: 5 }, ...]
    const result = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const found = registrations.find(r => r._id.year === year && r._id.month === month);
      result.push({
        month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
        count: found ? found.count : 0
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching registration data', error: err.message });
  }
});

// --- Organization Management ---
// List all organizations
router.get('/organizations', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const orgs = await Organization.find({}, 'name email plan subscriptionStatus status createdAt trialStartDate trialEndDate');
    // For each org, find the admin user
    const orgsWithAdmin = await Promise.all(orgs.map(async (org) => {
      const adminUser = await User.findOne({ organization: org._id, role: 'admin' });
      return {
        _id: org._id,
        name: org.name,
        email: org.email,
        plan: org.plan,
        subscriptionStatus: org.subscriptionStatus,
        status: org.status,
        createdAt: org.createdAt,
        trialStartDate: org.trialStartDate,
        trialEndDate: org.trialEndDate,
        adminEmail: adminUser ? adminUser.email : '',
        adminPhone: adminUser ? adminUser.phone : '',
      };
    }));
    res.json(orgsWithAdmin);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching organizations', error: err.message });
  }
});

// Suspend organization
router.patch('/organizations/:id/suspend', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { reason, expiry } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: 'Suspended', suspensionReason: reason, suspensionExpiry: expiry },
      { new: true }
    );
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Error suspending organization', error: err.message });
  }
});

// Delete organization
router.delete('/organizations/:id', authenticateToken, ownerOnly, async (req, res) => {
  try {
    await Organization.findByIdAndDelete(req.params.id);
    res.json({ message: 'Organization deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting organization', error: err.message });
  }
});

// Upgrade/downgrade plan
router.patch('/organizations/:id/plan', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { plan } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { plan },
      { new: true }
    );
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Error updating plan', error: err.message });
  }
});

// Send direct message to org (demo: just logs message)
router.post('/organizations/:id/message', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { message } = req.body;
    // In production, send email or notification
    console.log(`Message to org ${req.params.id}:`, message);
    res.json({ message: 'Message sent (demo)' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
});

// --- Support Inbox ---
// For demo, assume contact messages are stored in a ContactMessage model
router.get('/support/inbox', authenticateToken, ownerOnly, async (req, res) => {
  if (!ContactMessage) return res.json([]);
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
});

router.post('/support/reply', authenticateToken, ownerOnly, async (req, res) => {
  // In production, send email and log reply
  const { to, reply } = req.body;
  console.log(`Reply to ${to}:`, reply);
  res.json({ message: 'Reply sent (demo)' });
});

// Public contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, company, phone, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required.' });
    }
    const contactMsg = new ContactMessage({ name, email, company, phone, message });
    await contactMsg.save();
    res.json({ success: true, message: 'Message submitted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting message', error: err.message });
  }
});

// Payment Gateway Config Endpoints
router.get('/payment-gateway-config', authenticateToken, ownerOnly, getConfig);
router.post('/payment-gateway-config', authenticateToken, ownerOnly, saveOrUpdateConfig);
router.post('/payment-gateway-config/test', authenticateToken, ownerOnly, testConnection);

module.exports = router; 