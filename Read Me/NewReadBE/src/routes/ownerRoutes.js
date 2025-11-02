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
    const orgs = await Organization.find({}, 'name email plan subscriptionStatus isSuspended suspensionReason suspendedAt createdAt trialStartDate trialEndDate');
    // For each org, find the admin user
    const orgsWithAdmin = await Promise.all(orgs.map(async (org) => {
      const adminUser = await User.findOne({ organization: org._id, role: 'admin' });
      return {
        _id: org._id,
        name: org.name,
        email: org.email,
        plan: org.plan,
        subscriptionStatus: org.subscriptionStatus,
        isSuspended: org.isSuspended,
        suspensionReason: org.suspensionReason,
        suspendedAt: org.suspendedAt,
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

// Pause/Unpause organization subscription
router.patch('/organizations/:id/pause', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { reason, action } = req.body;
    const organization = await Organization.findById(req.params.id);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (action === 'pause') {
      // Pause the organization
      organization.isSuspended = true;
      organization.subscriptionStatus = 'paused';
      organization.suspensionReason = reason || 'Paused by owner';
      organization.suspendedAt = new Date();
      organization.suspendedBy = req.user.email;
      
      // Log the pause action
      console.log(`Organization ${organization.name} (${organization._id}) paused by ${req.user.email}. Reason: ${reason || 'No reason provided'}`);
      
    } else if (action === 'unpause') {
      // Unpause the organization - restore previous status
      organization.isSuspended = false;
      organization.subscriptionStatus = organization.subscriptionStatus === 'paused' ? 'trial' : organization.subscriptionStatus;
      organization.suspensionReason = '';
      organization.suspendedAt = null;
      organization.suspendedBy = '';
      
      // Log the unpause action
      console.log(`Organization ${organization.name} (${organization._id}) unpaused by ${req.user.email}`);
    }

    await organization.save();
    
    res.json({
      success: true,
      message: `Organization ${action === 'pause' ? 'paused' : 'unpaused'} successfully`,
      organization: {
        _id: organization._id,
        name: organization.name,
        isSuspended: organization.isSuspended,
        subscriptionStatus: organization.subscriptionStatus,
        suspensionReason: organization.suspensionReason,
        suspendedAt: organization.suspendedAt
      }
    });
    
  } catch (err) {
    console.error('Error pausing/unpausing organization:', err);
    res.status(500).json({ message: 'Error updating organization status', error: err.message });
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
    
    // Validate plan
    const validPlans = ['basic', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid plan. Must be one of: basic, professional, enterprise' 
      });
    }
    
    // Find the organization
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ 
        success: false,
        message: 'Organization not found' 
      });
    }
    
    // Store the old plan for logging
    const oldPlan = organization.plan;
    
    // Check if organization is suspended and log warning
    if (organization.isSuspended) {
      console.log(`⚠️ WARNING: Plan change requested for SUSPENDED organization ${organization.name} (${organization._id}) by ${req.user.email}. Plan change will proceed but may not take effect until suspension is lifted.`);
    }
    
    // Update plan and related fields
    organization.plan = plan;
    
    // Update staff limit based on new plan
    let newStaffLimit = 10; // basic
    if (plan === 'professional') newStaffLimit = 100;
    if (plan === 'enterprise') newStaffLimit = 1000000; // effectively unlimited
    
    organization.staffLimit = newStaffLimit;
    
    // If upgrading from basic to higher plan, extend trial period
    if (oldPlan === 'basic' && (plan === 'professional' || plan === 'enterprise')) {
      const now = new Date();
      organization.trialStartDate = now;
      organization.trialEndDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
      organization.subscriptionStatus = 'trial';
      
      // Log the plan upgrade
      console.log(`Organization ${organization.name} (${organization._id}) plan upgraded from ${oldPlan} to ${plan} by ${req.user.email}. New trial period: ${organization.trialStartDate} to ${organization.trialEndDate}`);
    }
    
    // If downgrading, keep current trial/subscription dates but update status if needed
    if ((oldPlan === 'professional' || oldPlan === 'enterprise') && plan === 'basic') {
      // If currently in trial and downgrading, keep trial period
      if (organization.subscriptionStatus === 'trial') {
        // Trial period remains the same
        console.log(`Organization ${organization.name} (${organization._id}) plan downgraded from ${oldPlan} to ${plan} by ${req.user.email}. Trial period maintained.`);
      }
    }
    
    // Handle same plan selection (no change needed)
    if (oldPlan === plan) {
      console.log(`Organization ${organization.name} (${organization._id}) plan unchanged (${plan}) by ${req.user.email}. No updates needed.`);
      return res.status(200).json({
        success: true,
        message: `Organization plan is already set to ${plan}`,
        organization: {
          _id: organization._id,
          name: organization.name,
          plan: organization.plan,
          staffLimit: organization.staffLimit,
          trialStartDate: organization.trialStartDate,
          trialEndDate: organization.trialEndDate,
          subscriptionStatus: organization.subscriptionStatus,
          updatedAt: organization.updatedAt
        }
      });
    }
    
    // Add to payment history
    organization.paymentHistory.push({
      amount: 0, // Free plan change by owner
      plan: plan,
      date: new Date(),
      transactionId: `plan_change_${Date.now()}_by_${req.user.email}`
    });
    
    await organization.save();
    
    res.json({
      success: true,
      message: `Organization plan updated from ${oldPlan} to ${plan} successfully`,
      organization: {
        _id: organization._id,
        name: organization.name,
        plan: organization.plan,
        staffLimit: organization.staffLimit,
        trialStartDate: organization.trialStartDate,
        trialEndDate: organization.trialEndDate,
        subscriptionStatus: organization.subscriptionStatus,
        updatedAt: organization.updatedAt
      }
    });
    
  } catch (err) {
    console.error('Error updating organization plan:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating organization plan', 
      error: err.message 
    });
  }
});

// Send direct message to organization using SMTP
router.post('/organizations/:id/message', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { message, subject } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Message content is required' 
      });
    }

    // Find the organization
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ 
        success: false,
        message: 'Organization not found' 
      });
    }

    // Find all admin users in the organization
    const admins = await User.find({ 
      organization: organization._id, 
      role: 'admin' 
    }).select('email fullName');

    if (admins.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No admin users found in this organization' 
      });
    }

    // Import email service
    const { sendOwnerMessageEmail } = require('../services/emailService');

    // Send the message via email
    const emailResult = await sendOwnerMessageEmail({
      organization,
      admins,
      message: message.trim(),
      ownerEmail: req.user.email,
      subject: subject || 'Message from StaffBridge Support'
    });

    // Log the message for audit purposes
    console.log(`Owner message sent to organization ${organization.name} (${organization._id}) by ${req.user.email}. Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

    res.json({
      success: true,
      message: `Message sent successfully to ${emailResult.messageCount} admin(s) in ${organization.name}`,
      details: {
        organizationName: organization.name,
        adminCount: emailResult.messageCount,
        adminEmails: admins.map(admin => admin.email)
      }
    });

  } catch (err) {
    console.error('Error sending message to organization:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error sending message', 
      error: err.message 
    });
  }
});

// Send message to multiple organizations
router.post('/organizations/bulk-message', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { organizationIds, message, subject } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Message content is required' 
      });
    }

    if (!organizationIds || !Array.isArray(organizationIds) || organizationIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Organization IDs are required' 
      });
    }

    // Import email service
    const { sendOwnerMessageEmail } = require('../services/emailService');

    const results = [];
    const errors = [];

    // Process each organization
    for (const orgId of organizationIds) {
      try {
        // Find the organization
        const organization = await Organization.findById(orgId);
        if (!organization) {
          errors.push({ organizationId: orgId, error: 'Organization not found' });
          continue;
        }

        // Find all admin users in the organization
        const admins = await User.find({ 
          organization: organization._id, 
          role: 'admin' 
        }).select('email fullName');

        if (admins.length === 0) {
          errors.push({ 
            organizationId: orgId, 
            organizationName: organization.name,
            error: 'No admin users found' 
          });
          continue;
        }

        // Send the message via email
        const emailResult = await sendOwnerMessageEmail({
          organization,
          admins,
          message: message.trim(),
          ownerEmail: req.user.email,
          subject: subject || 'Message from StaffBridge Support'
        });

        results.push({
          organizationId: orgId,
          organizationName: organization.name,
          success: true,
          adminCount: emailResult.messageCount,
          adminEmails: admins.map(admin => admin.email)
        });

        // Log the message for audit purposes
        console.log(`Bulk owner message sent to organization ${organization.name} (${organization._id}) by ${req.user.email}. Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

      } catch (error) {
        console.error(`Error sending message to organization ${orgId}:`, error);
        errors.push({ 
          organizationId: orgId, 
          error: error.message 
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    const totalProcessed = successCount + errorCount;

    res.json({
      success: true,
      message: `Bulk message completed. ${successCount} successful, ${errorCount} failed out of ${totalProcessed} organizations.`,
      summary: {
        totalProcessed,
        successCount,
        errorCount
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Error sending bulk message to organizations:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error sending bulk message', 
      error: err.message 
    });
  }
});

// Send message to all organizations
router.post('/organizations/message-all', authenticateToken, ownerOnly, async (req, res) => {
  try {
    const { message, subject } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Message content is required' 
      });
    }

    // Get all organizations
    const organizations = await Organization.find({});
    
    if (organizations.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No organizations found' 
      });
    }

    // Import email service
    const { sendOwnerMessageEmail } = require('../services/emailService');

    const results = [];
    const errors = [];

    // Process each organization
    for (const organization of organizations) {
      try {
        // Find all admin users in the organization
        const admins = await User.find({ 
          organization: organization._id, 
          role: 'admin' 
        }).select('email fullName');

        if (admins.length === 0) {
          errors.push({ 
            organizationId: organization._id,
            organizationName: organization.name,
            error: 'No admin users found' 
          });
          continue;
        }

        // Send the message via email
        const emailResult = await sendOwnerMessageEmail({
          organization,
          admins,
          message: message.trim(),
          ownerEmail: req.user.email,
          subject: subject || 'Message from StaffBridge Support'
        });

        results.push({
          organizationId: organization._id,
          organizationName: organization.name,
          success: true,
          adminCount: emailResult.messageCount,
          adminEmails: admins.map(admin => admin.email)
        });

        // Log the message for audit purposes
        console.log(`All-org message sent to organization ${organization.name} (${organization._id}) by ${req.user.email}. Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

      } catch (error) {
        console.error(`Error sending message to organization ${organization.name}:`, error);
        errors.push({ 
          organizationId: organization._id,
          organizationName: organization.name,
          error: error.message 
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    const totalProcessed = successCount + errorCount;

    res.json({
      success: true,
      message: `Message sent to all organizations. ${successCount} successful, ${errorCount} failed out of ${totalProcessed} organizations.`,
      summary: {
        totalProcessed,
        successCount,
        errorCount
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Error sending message to all organizations:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error sending message to all organizations', 
      error: err.message 
    });
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

// --- Organization Linking Endpoints ---
const organizationLinkingController = require('../controllers/organizationLinkingController');

// Get all organizations with linking status
router.get('/organization-linking/organizations', authenticateToken, ownerOnly, organizationLinkingController.getOrganizationsWithLinkingStatus);

// Get organization network hierarchy
router.get('/organization-linking/network', authenticateToken, ownerOnly, organizationLinkingController.getOrganizationNetwork);

// Get all head offices for dashboard navigation
router.get('/organization-linking/head-offices', authenticateToken, ownerOnly, organizationLinkingController.getHeadOffices);

// Get available organizations for linking (standalone organizations only)
router.get('/organization-linking/available-organizations', authenticateToken, ownerOnly, organizationLinkingController.getAvailableOrganizationsForLinking);

// Create head office from existing organization
router.post('/organization-linking/create-head-office', authenticateToken, ownerOnly, organizationLinkingController.createHeadOffice);

// Link organizations to existing head office
router.post('/organization-linking/link-organizations', authenticateToken, ownerOnly, organizationLinkingController.linkOrganizations);

// Unlink organization from head office
router.delete('/organization-linking/unlink/:organizationId', authenticateToken, ownerOnly, organizationLinkingController.unlinkOrganization);

// Update data sharing configuration
router.put('/organization-linking/data-sharing/:organizationId', authenticateToken, ownerOnly, organizationLinkingController.updateDataSharingConfig);

// Get cross-organization analytics
router.get('/organization-linking/analytics/:headOfficeId', authenticateToken, ownerOnly, organizationLinkingController.getCrossOrganizationAnalytics);

module.exports = router; 