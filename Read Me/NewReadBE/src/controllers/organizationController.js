const Organization = require('../models/Organization');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const PDFDocument = require('pdfkit');
const path = require('path');
const { uploadFile, getSignedUrl } = require('../utils/s3');

// Helper function to generate receipt PDF buffer
const generateReceiptPDFBuffer = async (organization, payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      // Page dimensions
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const centerX = doc.page.margins.left + pageWidth / 2;

      // Header with StaffBridge name (no logo)
      doc
        .fontSize(32)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('StaffBridge', centerX, 60, { align: 'center' });

      // Company address (static)
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text('30 N Gould St Ste N, Sheridan, WY 82801', centerX, doc.y + 10, { align: 'center' })
        .moveDown(2);

      // Divider line
      doc
        .moveTo(doc.page.margins.left, doc.y + 10)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y + 10)
        .strokeColor('#E5E7EB')
        .lineWidth(2)
        .stroke()
        .moveDown(2);

      // Payment Receipt title
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#E67E22')
        .text('Payment Receipt', centerX, doc.y, { align: 'center' })
        .moveDown(2);

      // Receipt details with improved spacing and formatting
      let currentY = doc.y;

      // Receipt number
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Receipt #:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payment.transactionId, doc.page.margins.left + 80, currentY);
      currentY += 25;

      // Date
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Date:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(new Date(payment.date).toLocaleDateString(), doc.page.margins.left + 80, currentY);
      currentY += 35;

      // Organization
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Organization:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(organization.name, doc.page.margins.left + 100, currentY);
      currentY += 25;

      // Email
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Email:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(organization.email, doc.page.margins.left + 80, currentY);
      currentY += 35;

      // Plan (with underline)
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Plan:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151');
      
      // Add underline for plan
      const planText = payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1);
      doc.text(planText, doc.page.margins.left + 80, currentY);
      doc
        .moveTo(doc.page.margins.left + 80, currentY + 15)
        .lineTo(doc.page.margins.left + 80 + doc.widthOfString(planText), currentY + 15)
        .strokeColor('#374151')
        .lineWidth(0.5)
        .stroke();
      currentY += 25;

      // Amount (in green)
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Amount:', doc.page.margins.left, currentY)
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#16A34A')
        .text(`$${payment.amount}`, doc.page.margins.left + 80, currentY);
      currentY += 25;

      // Transaction ID
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Transaction ID:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payment.transactionId, doc.page.margins.left + 120, currentY);
      currentY += 40;

      // Thank you message
      doc
        .fontSize(16)
        .font('Helvetica')
        .fillColor('#1C4E80')
        .text('Thank you for your payment and for choosing StaffBridge!', centerX, currentY, { align: 'center' });
      
      currentY += 40;

      // Footer divider
      doc
        .moveTo(doc.page.margins.left, currentY)
        .lineTo(doc.page.width - doc.page.margins.right, currentY)
        .strokeColor('#E5E7EB')
        .lineWidth(1.5)
        .stroke();

      // Footer with support email
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('For support, contact support@stfbridge.com', centerX, currentY + 20, { align: 'center' });

      // End the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to generate and store receipt to S3
const generateAndStoreReceipt = async (organization, payment) => {
  try {
    // Generate unique filename with organization isolation: receipts/{orgId}/{txnId}.pdf
    const orgId = organization._id;
    const txnId = payment.transactionId;
    const s3Key = `receipts/${orgId}/${txnId}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = await generateReceiptPDFBuffer(organization, payment);

    // Upload to S3
    await uploadFile(
      { 
        buffer: pdfBuffer, 
        mimetype: 'application/pdf', 
        originalname: `receipt-${txnId}.pdf` 
      }, 
      s3Key
    );

    console.log(`Receipt generated and stored: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Error generating and storing receipt:', error);
    throw error;
  }
};

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

    // Create default roles for the organization
    try {
      const { createDefaultRoles } = require('./roleController');
      await createDefaultRoles(organization._id);
      console.log('Default roles created for organization:', organization._id);
    } catch (roleError) {
      console.error('Error creating default roles:', roleError);
      // Don't fail the entire operation if role creation fails
    }

    // Send welcome email (onboarding)
    try {
      // const { sendWelcomeEmail } = require('../utils/welcomeEmail'); // Commented out SendGrid implementation
      const { sendWelcomeEmail } = require('../services/emailService'); // New SMTP implementation
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
      _id: organization._id, // <-- Add this line
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
    organization: req.user.organization
  });

  const departmentStats = await User.aggregate([
    { 
      $match: { 
        organization: req.user.organization
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
    // Add payment record - per-staff pricing
    const planPricesPerStaff = { basic: 1.99, professional: 3.99, enterprise: 6.99 };
    
    // Get staff count
    const User = require('../models/User');
    const staffCount = await User.countDocuments({
      organization: organization._id,
      status: { $ne: 'archived' }
    });
    
    const pricePerStaff = planPricesPerStaff[plan] || 1.99;
    const monthlyAmount = pricePerStaff * Math.max(staffCount, 1);
    const annualAmount = monthlyAmount * 12;
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
    
    // Debug: Log the request details
    console.log('Receipt request:', {
      transactionId,
      userId: req.user._id,
      userRole: req.user.role,
      userOrg: req.user.organization,
      userOrgType: typeof req.user.organization
    });
    
    const organization = await Organization.findById(req.user.organization);
    if (!organization) {
      console.log('Organization not found for user:', req.user._id);
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    const payment = (organization.paymentHistory || []).find(p => p.transactionId === transactionId);
    if (!payment) {
      console.log('Payment not found for transaction ID:', transactionId, 'in organization:', organization._id);
      return res.status(404).json({ message: 'Receipt not found' });
    }

    // Security check: Ensure user belongs to the organization that made the payment
    const userOrgId = req.user.organization._id ? req.user.organization._id.toString() : req.user.organization.toString();
    const paymentOrgId = organization._id.toString();
    
    console.log('Organization comparison:', {
      userOrgId,
      paymentOrgId,
      match: userOrgId === paymentOrgId
    });
    
    if (userOrgId !== paymentOrgId) {
      console.log('Organization mismatch for receipt access:', {
        userOrgId,
        paymentOrgId,
        transactionId
      });
      return res.status(403).json({ error: 'Access denied. Organization mismatch.' });
    }

    // Generate organization-isolated S3 key for the receipt
    const orgId = organization._id;
    const txnId = payment.transactionId;
    const s3Key = `receipts/${orgId}/${txnId}.pdf`;

    try {
      // Try to get signed URL for existing receipt
      const signedUrl = getSignedUrl(s3Key, 300); // 5 minutes expiry
      
      // Return the signed URL instead of generating PDF
      res.json({ 
        signedUrl,
        message: 'Receipt available for download',
        transactionId: payment.transactionId,
        organizationName: organization.name
      });
    } catch (s3Error) {
      // If receipt doesn't exist in S3, generate it on-demand (fallback)
      console.log(`Receipt not found in S3, generating on-demand: ${s3Key}`);
      
      try {
        // Generate and store receipt
        await generateAndStoreReceipt(organization, payment);
        
        // Get signed URL for the newly generated receipt
        const signedUrl = getSignedUrl(s3Key, 300);
        
        res.json({ 
          signedUrl,
          message: 'Receipt generated and available for download',
          transactionId: payment.transactionId,
          organizationName: organization.name
        });
      } catch (generateError) {
        console.error('Error generating receipt on-demand:', generateError);
        res.status(500).json({ error: 'Failed to generate receipt' });
      }
    }
  } catch (error) {
    console.error('Error serving receipt:', error);
    res.status(500).json({ error: 'Error serving receipt' });
  }
};

exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const now = new Date();
    const trialEndDate = organization.trialEndDate;
    const subscriptionEndDate = organization.subscriptionEndDate;
    
    // Determine current status
    let currentStatus = organization.subscriptionStatus;
    let statusChanged = false;
    
    if (currentStatus === 'trial' && trialEndDate && now > trialEndDate) {
      currentStatus = 'expired';
      statusChanged = true;
    } else if (currentStatus === 'active' && subscriptionEndDate && now > subscriptionEndDate) {
      currentStatus = 'expired';
      statusChanged = true;
    }

    // Update the database if status has changed
    if (statusChanged) {
      organization.subscriptionStatus = currentStatus;
      await organization.save();
      console.log(`Updated organization ${organization.name} (${organization._id}) subscription status to: ${currentStatus}`);
    }

    res.json({
      success: true,
      data: {
        _id: organization._id,
        name: organization.name,
        plan: organization.plan,
        trialStartDate: organization.trialStartDate,
        trialEndDate: organization.trialEndDate,
        subscriptionStartDate: organization.subscriptionStartDate,
        subscriptionEndDate: organization.subscriptionEndDate,
        subscriptionStatus: currentStatus,
        staffLimit: organization.staffLimit
      }
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Export the receipt generation function for use in other controllers
exports.generateAndStoreReceipt = generateAndStoreReceipt; 