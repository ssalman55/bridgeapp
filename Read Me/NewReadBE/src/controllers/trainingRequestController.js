const TrainingRequest = require('../models/TrainingRequest');
const User = require('../models/User');
const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
const notificationService = require('../services/notificationService');
const { sendTrainingRequestEmail, sendTrainingRequestApprovalEmail } = require('../services/emailService');
const Organization = require('../models/Organization');
const { processProfileImagesInArray } = require('../utils/profileImageHelper');
const { uploadToS3 } = require('../utils/s3');

// Staff: Create or update (save as draft or submit)
exports.createOrUpdateRequest = async (req, res) => {
  try {
    const { id } = req.body;
    
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    // Fetch currency from SystemSettings
    const settings = await SystemSettings.findOne({ organization: organizationId });
    const currency = settings?.currency || 'QAR';
    // Parse costBreakdown if sent as JSON string
    if (req.body.costBreakdown && typeof req.body.costBreakdown === 'string') {
      try {
        req.body.costBreakdown = JSON.parse(req.body.costBreakdown);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid costBreakdown format' });
      }
    }
    let request;
    // Remove staffId from req.body to prevent overwrite
    const { staffId, ...rest } = req.body;
    if (id) {
      request = await TrainingRequest.findOne({ _id: id, staffId: req.user._id, organization: organizationId });
      if (!request) return res.status(404).json({ message: 'Request not found' });
      Object.assign(request, rest, { status: req.body.status || request.status });
      request.staffId = req.user._id;
      request.currency = currency;
    } else {
      request = new TrainingRequest({ ...rest, staffId: req.user._id, organization: organizationId, currency });
    }
    // Handle file upload if present - upload to S3
    if (req.file) {
      try {
        // Get organization ID for folder structure
        let orgIdString = '';
        if (typeof organizationId === 'string') {
          orgIdString = organizationId;
        } else if (organizationId && organizationId._id) {
          orgIdString = organizationId._id.toString();
        } else if (organizationId && organizationId.toString) {
          orgIdString = organizationId.toString();
        } else {
          orgIdString = String(organizationId);
        }
        
        // Clean and validate the organization ID
        orgIdString = orgIdString.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (!orgIdString || orgIdString.length < 12) {
          console.error('[Training Request Upload] Invalid organization ID:', organizationId);
          return res.status(500).json({ message: 'Invalid organization context' });
        }
        
        const orgIdShort = orgIdString.slice(-12); // Use last 12 chars of org ID
        const folder = `training/${orgIdShort}`;
        
        // Upload to S3
        const fileUrl = await uploadToS3(req.file, folder);
        
        // Extract S3 key from URL for download endpoint
        const urlObj = new URL(fileUrl);
        const s3Key = urlObj.pathname.substring(1); // Remove leading slash
        
        request.attachment = {
          filename: req.file.originalname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl,
          s3Key: s3Key
        };
      } catch (uploadError) {
        console.error('Error uploading training request attachment to S3:', uploadError);
        return res.status(500).json({ message: 'Failed to upload attachment', error: uploadError.message });
      }
    }
    if (req.body.documents) {
      let docIds = Array.isArray(req.body.documents) ? req.body.documents : [req.body.documents];
      request.documents = docIds;
    }
    await request.save();
    
    // Notify all admins if request is submitted (status === 'Pending')
    if (request.status === 'Pending') {
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
        console.error('Organization not found for training request:', organizationId);
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
          message: `${req.user.fullName} submitted a new training request.`,
          type: 'training',
          link: '/admin/training-requests',
          sender: req.user._id
        })));

        // Send SMTP emails to all admins in the same organization only
        if (admins.length > 0) {
          try {
            console.log(`Sending training request emails to ${admins.length} admins in organization: ${organization.name} (${organizationId})`);
            
            const emailResult = await sendTrainingRequestEmail({
              organization,
              admins,
              submitter: {
                fullName: req.user.fullName,
                email: req.user.email
              },
              trainingRequest: request
            });
            
            console.log('Training request emails sent successfully:', {
              organization: organization.name,
              organizationId: organizationId,
              totalSent: emailResult.totalSent,
              totalFailed: emailResult.totalFailed,
              successfulEmails: emailResult.successfulEmails,
              failedEmails: emailResult.failedEmails
            });
          } catch (emailError) {
            console.error('Failed to send training request emails:', emailError);
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
    res.status(201).json(request);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', details: err.errors });
    }
    res.status(500).json({ message: err.message });
  }
};

// Staff: Get my requests
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await TrainingRequest.find({ staffId: req.user._id, organization: req.user.organization })
      .populate('staffId', 'fullName email department profileImage')
      .populate('approvedRejectedBy', 'fullName')
      .populate('documents')
      .sort({ requestedDate: -1 });
    
    // Convert profile images to signed URLs
    const processedRequests = processProfileImagesInArray(requests);
    res.json(processedRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: List all requests with filters
exports.getAllRequests = async (req, res) => {
  try {
    const { status, department, staffId } = req.query;
    const query = { organization: req.user.organization };
    if (status) {
      query.status = status;
    } else {
      query.status = 'Pending';
    }
    if (staffId) query.staffId = staffId;
    if (department) {
      const staff = await User.find({ department, organization: req.user.organization, status: { $ne: 'archived' } }, '_id');
      query.staffId = { $in: staff.map(s => s._id) };
    }
    const requests = await TrainingRequest.find(query)
      .populate('staffId', 'fullName email department profileImage')
      .populate('approvedRejectedBy', 'fullName')
      .populate('documents')
      .sort({ requestedDate: -1 });
    
    // Convert profile images to signed URLs
    const processedRequests = processProfileImagesInArray(requests);
    res.json(processedRequests);
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
    // Fetch currency from SystemSettings
    const settings = await SystemSettings.findOne({ organization: req.user.organization });
    const currency = settings?.currency || 'QAR';
    const request = await TrainingRequest.findOne({ _id: id, organization: req.user.organization });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    request.status = status;
    request.adminComment = adminComment;
    request.decisionDate = new Date();
    request.approvedRejectedBy = req.user._id;
    request.currency = currency;
    await request.save();

    // Email the staff submitter on approval/rejection; enforce tenant isolation
    try {
      const submitter = await User.findOne({ _id: request.staffId, organization: request.organization })
        .select('fullName email organization');
      const organizationObj = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
        ? req.user.organization
        : await Organization.findById(request.organization).select('name');
      if (submitter && organizationObj) {
        if (status === 'Approved') {
          await sendTrainingRequestApprovalEmail({ organization: organizationObj, submitter, admin: { fullName: req.user.fullName, email: req.user.email }, request });
        } else if (status === 'Rejected') {
          const { sendTrainingRequestRejectionEmail } = require('../services/emailService');
          await sendTrainingRequestRejectionEmail({ organization: organizationObj, submitter, admin: { fullName: req.user.fullName, email: req.user.email }, request, adminComment });
        }
      }
    } catch (emailErr) {
      console.error('Failed to send training request decision email:', emailErr);
    }

    // Notify the user whose request was actioned
    await notificationService.notifyUser({
      userId: request.staffId,
      organization: request.organization,
      message: `Your training request has been ${status.toLowerCase()}.`,
      type: 'training',
      link: '/my-training-requests',
      sender: req.user._id
    });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get approved requests
exports.getApprovedRequests = async (req, res) => {
  try {
    const requests = await TrainingRequest.find({ status: 'Approved', organization: req.user.organization })
      .populate('staffId', 'fullName email department profileImage')
      .populate('approvedRejectedBy', 'fullName')
      .populate('documents')
      .sort({ decisionDate: -1 });
    
    // Convert profile images to signed URLs
    const processedRequests = processProfileImagesInArray(requests);
    res.json(processedRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Training cost summary
exports.getTrainingCosts = async (req, res) => {
  try {
    // Fix organization filter to use only ObjectId
    const orgId = req.user.organization._id ? req.user.organization._id : req.user.organization;
    const match = {
      status: 'Approved',
      organization: typeof orgId === 'string' ? new mongoose.Types.ObjectId(orgId) : orgId
    };

    // Add year filter if provided
    if (req.query.year) {
      const year = parseInt(req.query.year, 10);
      if (!isNaN(year)) {
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        match.requestedDate = { $gte: start, $lt: end };
      }
    }

    console.log('Training cost match filter:', match);
    const count = await TrainingRequest.countDocuments(match);
    console.log('Matching documents count:', count);

    // Fetch currency from SystemSettings
    const settings = await SystemSettings.findOne({ organization: orgId });
    const currency = settings?.currency || 'QAR';

    const summary = await TrainingRequest.aggregate([
      { $match: match },
      { $group: {
          _id: '$staffId',
          registrationFee: { $sum: { $ifNull: ['$costBreakdown.registrationFee', 0] } },
          travelCost: { $sum: { $ifNull: ['$costBreakdown.travelCost', 0] } },
          accommodationCost: { $sum: { $ifNull: ['$costBreakdown.accommodationCost', 0] } },
          mealCost: { $sum: { $ifNull: ['$costBreakdown.mealCost', 0] } },
          otherCost: { $sum: { $ifNull: ['$costBreakdown.otherCost', 0] } },
          total: { $sum: {
            $add: [
              { $ifNull: ['$costBreakdown.registrationFee', 0] },
              { $ifNull: ['$costBreakdown.travelCost', 0] },
              { $ifNull: ['$costBreakdown.accommodationCost', 0] },
              { $ifNull: ['$costBreakdown.mealCost', 0] },
              { $ifNull: ['$costBreakdown.otherCost', 0] }
            ]
          } },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          registrationFee: 1,
          travelCost: 1,
          accommodationCost: 1,
          mealCost: 1,
          otherCost: 1,
          total: 1,
          count: 1,
          staffId: '$_id',
          fullName: '$staff.fullName',
          department: '$staff.department',
          profileImage: '$staff.profileImage'
        }
      }
    ]);

    // Process profile images in summary
    const processedSummary = processProfileImagesInArray(summary);

    // Calculate overall totals for chart
    const overall = processedSummary.reduce((acc, row) => {
      acc.registrationFee += row.registrationFee || 0;
      acc.travelCost += row.travelCost || 0;
      acc.accommodationCost += row.accommodationCost || 0;
      acc.mealCost += row.mealCost || 0;
      acc.otherCost += row.otherCost || 0;
      acc.total += row.total || 0;
      return acc;
    }, { registrationFee: 0, travelCost: 0, accommodationCost: 0, mealCost: 0, otherCost: 0, total: 0 });

    res.json({ summary: processedSummary, overall, currency });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin/Staff: Get request by ID
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await TrainingRequest.findOne({ _id: id, organization: req.user.organization })
      .populate('staffId', 'fullName email department')
      .populate('documents');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get rejected requests
exports.getRejectedRequests = async (req, res) => {
  try {
    const requests = await TrainingRequest.find({ status: 'Rejected', organization: req.user.organization })
      .populate('staffId', 'fullName email department profileImage')
      .populate('approvedRejectedBy', 'fullName')
      .populate('documents')
      .sort({ decisionDate: -1 });
    
    // Convert profile images to signed URLs
    const processedRequests = processProfileImagesInArray(requests);
    res.json(processedRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Staff: Delete own request
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await TrainingRequest.findOne({ _id: id, staffId: req.user._id, organization: req.user.organization });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (['Approved', 'Rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'Cannot delete an approved or rejected request' });
    }
    await request.deleteOne();
    res.json({ success: true, message: 'Training request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}; 