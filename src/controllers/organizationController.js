const Organization = require('../models/Organization');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const PDFDocument = require('pdfkit');
const path = require('path');

// Register new organization and create admin user
exports.registerOrganization = async (req, res) => {
  try {
    const { 
      name, 
      email,
      phone,
      industry,
      website,
      description,
      settings,
      adminFullName,
      adminEmail,
      adminPassword,
      department
    } = req.body;

    // Check if organization already exists
    const existingOrg = await Organization.findOne({ 
      $or: [
        { name },
        { email }
      ]
    });

    if (existingOrg) {
      return res.status(400).json({ 
        message: 'Organization with this name or email already exists' 
      });
    }

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(400).json({ 
        message: 'Admin user with this email already exists' 
      });
    }

    // Plan selection and trial logic
    const plan = req.body.plan || 'basic';
    const now = new Date();
    let staffLimit = 10;
    if (plan === 'professional') staffLimit = 100;
    if (plan === 'enterprise') staffLimit = 1000000; // Effectively unlimited

    // Create organization
    const organization = await Organization.create({
      name,
      email: adminEmail,
      phone,
      industry,
      website,
      description,
      settings,
      plan,
      trialStartDate: now,
      trialEndDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      subscriptionStatus: 'trial',
      staffLimit
    });

    // Hash admin password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user for the organization
    const admin = await User.create({
      fullName: adminFullName,
      email: adminEmail,
      password: hashedPassword,
      organization: organization._id,
      department: department || 'Administration',
      role: 'admin'
    });

    // Send welcome email (onboarding)
    try {
      const { sendWelcomeEmail } = require('../utils/welcomeEmail');
      await sendWelcomeEmail({
        organization,
        admin,
        plan,
        trialStartDate: organization.trialStartDate,
        trialEndDate: organization.trialEndDate
      });
      // Optionally log success in DB or monitoring
      console.log('Welcome email sent to', admin.email);
    } catch (emailErr) {
      // Log failure for auditing
      console.error('Failed to send welcome email:', emailErr);
    }

    res.status(201).json({
      message: 'Organization and admin user created successfully',
      organization: {
        id: organization._id,
        name: organization.name,
        email: organization.email,
        industry: organization.industry
      },
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ 
      message: 'Error creating organization',
      error: error.message 
    });
  }
};

// Get organization details (admin only)
exports.getOrganizationDetails = async (req, res) => {
  try {
    const organization = await Organization.findById(req.user.organization);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    res.json({
      plan: organization.plan,
      trialStartDate: organization.trialStartDate,
      trialEndDate: organization.trialEndDate,
      subscriptionStartDate: organization.subscriptionStartDate,
      subscriptionEndDate: organization.subscriptionEndDate,
      subscriptionStatus: organization.subscriptionStatus,
      staffLimit: organization.staffLimit,
      name: organization.name,
      email: organization.email,
      paymentHistory: organization.paymentHistory || []
    });
  } catch (error) {
    console.error('Error getting organization details:', error);
    res.status(500).json({ message: 'Error retrieving organization details' });
  }
};

// Update organization details (admin only)
exports.updateOrganization = async (req, res) => {
  try {
    const { name, email, phone, industry, website, description, settings } = req.body;
    const organization = await Organization.findById(req.user.organization);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Update fields if provided
    if (name) organization.name = name;
    if (email) organization.email = email;
    if (phone) organization.phone = phone;
    if (industry) organization.industry = industry;
    if (website) organization.website = website;
    if (description) organization.description = description;
    if (settings) organization.settings = { ...organization.settings, ...settings };

    await organization.save();

    res.json({
      message: 'Organization updated successfully',
      organization
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ message: 'Error updating organization' });
  }
};

// Get organization statistics (admin only)
exports.getOrganizationStats = asyncHandler(async (req, res) => {
  const totalStaff = await User.countDocuments({ 
    organization: req.user.organization,
    role: 'staff'
  });

  const departmentStats = await User.aggregate([
    { 
      $match: { 
        organization: req.user.organization,
        role: 'staff'
      }
    },
    {
      $group: {
        _id: '$department',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    totalStaff,
    departmentStats
  });
});

// Upgrade or renew organization subscription (admin only)
exports.upgradeOrganization = async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['basic', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan selected.' });
    }
    const organization = await Organization.findById(req.user.organization);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    // Set staff limit based on plan
    let staffLimit = 10;
    if (plan === 'professional') staffLimit = 100;
    if (plan === 'enterprise') staffLimit = 1000000;
    // Set subscription dates
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    organization.plan = plan;
    organization.staffLimit = staffLimit;
    organization.subscriptionStartDate = now;
    organization.subscriptionEndDate = oneYearLater;
    organization.subscriptionStatus = 'active';
    // Add payment record
    const planPrices = { basic: 29, professional: 79, enterprise: 199 };
    const annualAmount = planPrices[plan] * 12;
    organization.paymentHistory = organization.paymentHistory || [];
    organization.paymentHistory.push({
      amount: annualAmount,
      plan,
      date: now,
      transactionId: 'TXN-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    });
    await organization.save();
    res.json({
      message: 'Subscription upgraded successfully',
      plan: organization.plan,
      subscriptionStartDate: organization.subscriptionStartDate,
      subscriptionEndDate: organization.subscriptionEndDate,
      subscriptionStatus: organization.subscriptionStatus,
      staffLimit: organization.staffLimit,
      paymentHistory: organization.paymentHistory
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ message: 'Error upgrading subscription' });
  }
};

exports.getReceiptPDF = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const organization = await Organization.findById(req.user.organization);
    if (!organization) return res.status(404).json({ message: 'Organization not found' });
    const payment = (organization.paymentHistory || []).find(p => p.transactionId === transactionId);
    if (!payment) return res.status(404).json({ message: 'Receipt not found' });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt-${transactionId}.pdf`);
    doc.pipe(res);

    // Logo (PNG)
    const logoPath = path.join(__dirname, '../../public/images/staffbridge-logo.png');
    if (require('fs').existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 120 });
    }
    doc.moveDown(2);

    // Header
    doc
      .fontSize(24)
      .fillColor('#1C4E80')
      .text('StaffBridge', { align: 'left' })
      .moveDown(0.5);
    doc
      .fontSize(16)
      .fillColor('#EA6A47')
      .text('Payment Receipt', { align: 'left' })
      .moveDown(1);

    // Receipt Info
    doc
      .fontSize(12)
      .fillColor('#22223b')
      .text(`Receipt #: ${transactionId}`)
      .text(`Date: ${new Date(payment.date).toLocaleDateString()}`)
      .moveDown(0.5);

    // Organization Info
    doc
      .fontSize(12)
      .fillColor('#22223b')
      .text(`Organization: ${organization.name}`)
      .text(`Email: ${organization.email}`)
      .moveDown(0.5);

    // Payment Info
    doc
      .fontSize(12)
      .fillColor('#22223b')
      .text(`Plan: ${payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1)}`)
      .text(`Amount: $${payment.amount}`)
      .text(`Transaction ID: ${payment.transactionId}`)
      .moveDown(1);

    // Thank you note
    doc
      .fontSize(12)
      .fillColor('#1C4E80')
      .text('Thank you for your payment and for choosing StaffBridge!', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ message: 'Error generating receipt PDF' });
  }
}; 