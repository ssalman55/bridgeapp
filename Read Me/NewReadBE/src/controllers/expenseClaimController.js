const ExpenseClaim = require('../models/ExpenseClaim');
const User = require('../models/User');
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');
const Document = require('../models/Document');
const { sendExpenseClaimEmail } = require('../services/emailService');
const Organization = require('../models/Organization');
const { processProfileImagesInArray } = require('../utils/profileImageHelper');

// Staff: Create or update claim (draft/submit)
exports.createOrUpdateClaim = async (req, res) => {
  try {
    const { id, documents } = req.body;
    
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    let claim;
    if (id) {
      claim = await ExpenseClaim.findOne({ _id: id, staffId: req.user._id, organization: organizationId });
      if (!claim) return res.status(404).json({ message: 'Claim not found' });
      Object.assign(claim, req.body, { status: req.body.status || claim.status });
    } else {
      claim = new ExpenseClaim({ ...req.body, staffId: req.user._id, organization: organizationId });
    }
    // Handle file uploads
    if (req.files && req.files.length > 0) {
      claim.receipts = req.files.map(f => ({
        filename: f.filename,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        url: `/uploads/expense-claims/${f.filename}`
      }));
    }
    // --- Document attachment logic ---
    let newDocIds = Array.isArray(documents) ? documents : (documents ? [documents] : []);
    // Only allow attaching documents owned by the user and in the same org
    if (newDocIds.length > 0) {
      const validDocs = await Document.find({ _id: { $in: newDocIds }, uploadedBy: req.user._id, organization: organizationId });
      newDocIds = validDocs.map(doc => doc._id.toString());
    }
    // Compare previous and new document arrays for audit logs
    const prevDocIds = (claim.documents || []).map(id => id.toString());
    // Attach new docs
    const attachedNow = newDocIds.filter(id => !prevDocIds.includes(id));
    // Removed docs
    const removedNow = prevDocIds.filter(id => !newDocIds.includes(id));
    // Update claim documents
    claim.documents = newDocIds;
    // Audit log
    if (!claim.documentAuditLogs) claim.documentAuditLogs = [];
    attachedNow.forEach(docId => {
      claim.documentAuditLogs.push({
        document: docId,
        attachedBy: req.user._id,
        action: 'attached',
        attachedAt: new Date()
      });
    });
    removedNow.forEach(docId => {
      claim.documentAuditLogs.push({
        document: docId,
        attachedBy: req.user._id,
        action: 'removed',
        attachedAt: new Date()
      });
    });
    // --- End document logic ---
    if (claim.status === 'Pending' && !claim.submittedAt) {
      claim.submittedAt = new Date();
    }
    await claim.save();
    
    // Notify all admins if claim is submitted (status === 'Pending')
    if (claim.status === 'Pending') {
      // Get organization details for email
      let organization;
      if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
        // Organization is already populated
        organization = req.user.organization;
      } else {
        // Organization is not populated, fetch it
        organization = await Organization.findById(organizationId);
      }
      
      if (!organization) {
        console.error('Organization not found for expense claim:', organizationId);
      } else {
        // Notify all admins in the SAME organization only - ensure tenant isolation
        const admins = await User.find({ 
          organization: organizationId, 
          role: 'admin', 
          status: { $ne: 'archived' } 
        });
        
        console.log(`Found ${admins.length} admins in organization ${organization.name} (${organizationId})`);
        
        // Create in-app notifications for admins in the same organization
        await Promise.all(admins.map(admin => notificationService.notifyUser({
          userId: admin._id,
          organization: organizationId,
          message: `${req.user.fullName} submitted a new expense claim.`,
          type: 'expense',
          link: '/admin/expense-claims/pending',
          sender: req.user._id
        })));

        // Send SMTP emails to all admins in the same organization only
        if (admins.length > 0) {
          try {
            console.log(`Sending expense claim emails to ${admins.length} admins in organization: ${organization.name} (${organizationId})`);
            
            const emailResult = await sendExpenseClaimEmail({
              organization,
              admins,
              submitter: {
                fullName: req.user.fullName,
                email: req.user.email
              },
              claim
            });
            
            console.log('Expense claim emails sent successfully:', {
              organization: organization.name,
              organizationId: organizationId,
              totalSent: emailResult.totalSent,
              totalFailed: emailResult.totalFailed,
              successfulEmails: emailResult.successfulEmails,
              failedEmails: emailResult.failedEmails
            });
          } catch (emailError) {
            console.error('Failed to send expense claim emails:', emailError);
            // Don't fail the request if email sending fails
          }
        } else {
          console.log('No admins found in organization:', {
            organizationName: organization.name,
            organizationId: organizationId
          });
        }
      }
    }
    res.status(201).json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Staff: List my claims
exports.getMyClaims = async (req, res) => {
  try {
    const claims = await ExpenseClaim.find({ staffId: req.user._id, organization: req.user.organization })
      .populate('documents')
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: List claims with filters
exports.getAllClaims = async (req, res) => {
  try {
    const { status, staffId, category } = req.query;
    const query = { organization: req.user.organization };
    if (status) query.status = status;
    if (staffId) query.staffId = staffId;
    if (category) query.category = category;
    const claims = await ExpenseClaim.find(query)
      .populate('staffId', 'fullName email department profileImage')
      .populate('approvedRejectedBy', 'fullName profileImage')
      .populate('documents')
      .sort({ createdAt: -1 });
    
    // Convert profile images to signed URLs
    const processedClaims = processProfileImagesInArray(claims);
    res.json(processedClaims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Approve or reject
exports.approveOrReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const claim = await ExpenseClaim.findOne({ _id: id, organization: req.user.organization });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    claim.status = status;
    claim.decisionDate = new Date();
    claim.approvedRejectedBy = req.user._id;
    claim.approvalLogs.push({
      status,
      adminId: req.user._id,
      comment: adminComment,
      date: new Date()
    });
    await claim.save();

    // Email the staff submitter on approval/rejection; enforce tenant isolation
    try {
      const submitter = await User.findOne({ _id: claim.staffId, organization: claim.organization })
        .select('fullName email organization');
      const organizationObj = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
        ? req.user.organization
        : await Organization.findById(claim.organization).select('name');
      if (submitter && organizationObj) {
        if (status === 'Approved') {
          const { sendExpenseClaimApprovalEmail } = require('../services/emailService');
          await sendExpenseClaimApprovalEmail({ organization: organizationObj, submitter, admin: { fullName: req.user.fullName, email: req.user.email }, claim, adminComment });
        } else if (status === 'Rejected') {
          const { sendExpenseClaimRejectionEmail } = require('../services/emailService');
          await sendExpenseClaimRejectionEmail({ organization: organizationObj, submitter, admin: { fullName: req.user.fullName, email: req.user.email }, claim, adminComment });
        }
      }
    } catch (emailErr) {
      console.error('Failed to send expense claim decision email:', emailErr);
    }

    // Notify the user whose claim was actioned
    await notificationService.notifyUser({
      userId: claim.staffId,
      organization: claim.organization,
      message: `Your expense claim has been ${status.toLowerCase()}.`,
      type: 'expense',
      link: '/expense-claims',
      sender: req.user._id
    });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin/Staff: Get claim by ID
exports.getClaimById = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await ExpenseClaim.findOne({ _id: id, organization: req.user.organization })
      .populate('staffId', 'fullName email department')
      .populate('documents');
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Staff: Delete own claim
exports.deleteClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await ExpenseClaim.findOne({ _id: id, staffId: req.user._id, organization: req.user.organization });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    if (['Approved', 'Rejected'].includes(claim.status)) {
      return res.status(400).json({ message: 'Cannot delete an approved or rejected claim' });
    }
    await claim.deleteOne();
    res.json({ success: true, message: 'Expense claim deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}; 