const LeaveRequest = require('../models/LeaveRequest');
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { sendLeaveRequestEmail, sendLeaveApprovalEmail } = require('../services/emailService');
const Organization = require('../models/Organization');
const { processProfileImagesInArray } = require('../utils/profileImageHelper');
const { uploadToS3 } = require('../utils/s3');

// Staff: Submit a leave request
exports.submitLeaveRequest = asyncHandler(async (req, res) => {
  let { startDate, endDate, reason, leaveType, attachments, cloudDocuments } = req.body;
  
  // Handle cloudDocuments if sent as JSON string in FormData
  if (typeof cloudDocuments === 'string') {
    try {
      cloudDocuments = JSON.parse(cloudDocuments);
    } catch (e) {
      console.error('Failed to parse cloudDocuments:', e);
      cloudDocuments = [];
    }
  }
  
  // Debug logging
  console.log('Leave request submission:', {
    hasFiles: !!(req.files && req.files.length > 0),
    filesCount: req.files ? req.files.length : 0,
    bodyAttachments: attachments,
    startDate,
    endDate,
    leaveType
  });
  
  // Get the organization ID - handle both populated and unpopulated references
  let organizationId;
  if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
    // Organization is already populated
    organizationId = req.user.organization._id;
  } else {
    // Organization is not populated, use the ID directly
    organizationId = req.user.organization;
  }
  
  // Calculate total days
  const totalDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Validate document threshold requirements
  const LeaveType = require('../models/LeaveType');
  const leaveTypeObj = await LeaveType.findById(leaveType);
  
  // Process cloud documents (imported from cloud storage)
  let processedAttachments = [];
  if (cloudDocuments && Array.isArray(cloudDocuments)) {
    processedAttachments = cloudDocuments
      .filter(doc => doc.fileUrl || doc.url)
      .map(doc => ({
        filename: doc.name || doc._id,
        originalName: doc.name,
        url: doc.fileUrl || doc.url,
        size: doc.size || 0,
        mimeType: doc.mimeType || 'application/octet-stream',
        uploadedBy: req.user._id,
        documentType: 'other',
        uploadedAt: new Date()
      }));
  }
  
  // Process attachments from req.body (in case they were uploaded separately and URLs are provided)
  if (attachments && Array.isArray(attachments)) {
    const bodyAttachments = attachments
      .filter(attachment => {
        // Only include attachments that have been properly uploaded (have a valid URL)
        const hasValidUrl = attachment.url && 
                           typeof attachment.url === 'string' &&
                           attachment.url.startsWith('http') &&
                           attachment.url.includes('amazonaws.com');
        return hasValidUrl;
      })
      .map(attachment => ({
        ...attachment,
        uploadedBy: attachment.uploadedBy || req.user._id,
        uploadedAt: attachment.uploadedAt || new Date()
      }));
    
    processedAttachments = [...processedAttachments, ...bodyAttachments];
  }
  
  // Check if files are required and validate
  const hasFileUploads = req.files && req.files.length > 0;
  const hasValidAttachments = processedAttachments.length > 0;
  
  console.log('Document validation check:', {
    leaveTypeName: leaveTypeObj?.name,
    documentThresholdEnabled: leaveTypeObj?.documentThreshold?.enabled,
    documentThresholdDays: leaveTypeObj?.documentThreshold?.days,
    totalDays,
    hasFileUploads,
    hasValidAttachments,
    requiresDocument: leaveTypeObj?.documentThreshold?.enabled && totalDays > leaveTypeObj?.documentThreshold?.days
  });
  
  if (leaveTypeObj && leaveTypeObj.documentThreshold && leaveTypeObj.documentThreshold.enabled) {
    if (totalDays > leaveTypeObj.documentThreshold.days) {
      // Document is required - check both file uploads and existing attachments
      if (!hasFileUploads && !hasValidAttachments) {
        console.log('Document validation failed: no files uploaded and no valid attachments');
        return res.status(400).json({ 
          message: `Document upload is required for ${leaveTypeObj.name} requests exceeding ${leaveTypeObj.documentThreshold.days} days. Please upload supporting documents.` 
        });
      }
    }
  }

  // Create leave request first to get the ID, then upload files with proper naming
  let leave = await LeaveRequest.create({
    user: req.user._id,
    organization: organizationId,
    startDate,
    endDate,
    reason,
    leaveType,
    totalDays,
    attachments: [], // Start with empty array
  });
  
  // If files were uploaded, process them now that we have the leave request ID
  if (req.files && req.files.length > 0) {
    const uploadedAttachments = [];
    for (const file of req.files) {
      try {
        // Generate unique filename with leaveRequestId
        const fileExtension = file.originalname.split('.').pop();
        const timestamp = Date.now();
        const uniqueFilename = `leave-${leave._id}-${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
        
        // Upload to S3 with organization isolation
        const s3Key = `organizations/${organizationId}/leave-attachments/${leave._id}/${uniqueFilename}`;
        const fileUrl = await uploadToS3(file, s3Key);

        uploadedAttachments.push({
          filename: uniqueFilename,
          originalName: file.originalname,
          url: fileUrl,
          size: file.size,
          mimeType: file.mimetype,
          uploadedBy: req.user._id,
          documentType: 'other',
          uploadedAt: new Date()
        });
      } catch (uploadError) {
        console.error('Error uploading file to S3:', uploadError);
        // Continue with other files even if one fails
      }
    }
    
    // Combine with any attachments from req.body that already have URLs
    processedAttachments = [...uploadedAttachments, ...processedAttachments];
    
    // Update leave request with all attachments
    leave.attachments = processedAttachments;
    await leave.save();
  } else {
    // No files uploaded, but might have attachments from req.body with URLs
    leave.attachments = processedAttachments;
    await leave.save();
  }

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
    console.error('Organization not found for leave request:', organizationId);
  } else {
    // Notify all admins in the SAME organization only - ensure tenant isolation
    const admins = await User.find({ 
      organization: organizationId, 
      role: 'admin', 
      status: { $ne: 'archived' } 
    });
    
    console.log(`Found ${admins.length} admins in organization ${organization.name} (${organizationId})`);
    
    const staffName = req.user.fullName;
    const message = `${staffName} submitted a leave request`;
    const link = '/admin/leave-management';
    
    // Create in-app notifications for admins in the same organization
    await Promise.all(admins.map(admin => Notification.create({
      message,
      type: 'leave',
      link,
      recipient: admin._id,
      sender: req.user._id,
      organization: organizationId
    })));

    // Send SMTP emails to all admins in the same organization only
    if (admins.length > 0) {
      try {
        console.log(`Sending leave request emails to ${admins.length} admins in organization: ${organization.name} (${organizationId})`);
        
        const emailResult = await sendLeaveRequestEmail({
          organization,
          admins,
          submitter: {
            fullName: req.user.fullName,
            email: req.user.email
          },
          leaveRequest: leave
        });
        
        console.log('Leave request emails sent successfully:', {
          organization: organization.name,
          organizationId: organizationId,
          totalSent: emailResult.totalSent,
          totalFailed: emailResult.totalFailed,
          successfulEmails: emailResult.successfulEmails,
          failedEmails: emailResult.failedEmails
        });
      } catch (emailError) {
        console.error('Failed to send leave request emails:', emailError);
        // Don't fail the request if email sending fails
      }
    } else {
      console.log('No admins found in organization:', {
        organizationName: organization.name,
        organizationId: organizationId
      });
    }
  }

  res.status(201).json(leave);
});

// Staff: View their own leave requests
exports.getMyLeaveRequests = asyncHandler(async (req, res) => {
  const leaves = await LeaveRequest.find({ user: req.user._id })
    .populate('actionedBy', 'fullName')
    .populate('user', 'fullName email department profileImage')
    .populate('leaveType', 'name color icon documentThreshold')
    .populate('attachments.uploadedBy', 'fullName')
    .sort({ createdAt: -1 });
  
  // Convert profile images to signed URLs
  const processedLeaves = processProfileImagesInArray(leaves);
  res.json(processedLeaves);
});

// Admin: View all leave requests
exports.getAllLeaveRequests = asyncHandler(async (req, res) => {
  const leaves = await LeaveRequest.find({ organization: req.user.organization._id })
    .populate('user', 'fullName email department profileImage')
    .populate('actionedBy', 'fullName')
    .populate('leaveType', 'name color icon documentThreshold')
    .populate('attachments.uploadedBy', 'fullName')
    .sort({ createdAt: -1 });
  
  // Convert profile images to signed URLs
  const processedLeaves = processProfileImagesInArray(leaves);
  res.json(processedLeaves);
});

// Admin: Approve or reject a leave request
exports.updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, adminComment } = req.body;
  let leave = await LeaveRequest.findOne({ _id: req.params.id, organization: req.user.organization._id });
  if (!leave) {
    // Fallback for legacy requests (missing organization field)
    leave = await LeaveRequest.findById(req.params.id);
  }
  if (!leave) return res.status(404).json({ message: 'Leave request not found' });
  leave.status = status;
  if (adminComment) leave.adminComment = adminComment;
  if (status === 'Approved' || status === 'Rejected') {
    leave.actionedBy = req.user._id;

    // Email the submitter with strict tenant isolation (both approval and rejection)
    try {
      // Ensure the submitter belongs to the same organization
      const submitter = await User.findOne({ _id: leave.user, organization: leave.organization })
        .select('fullName email organization');
      const organizationObj = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
        ? req.user.organization
        : await Organization.findById(leave.organization).select('name');
      if (submitter && organizationObj) {
        if (status === 'Approved') {
          await sendLeaveApprovalEmail({ organization: organizationObj, submitter, admin: { fullName: req.user.fullName, email: req.user.email }, leave });
        } else if (status === 'Rejected') {
          const { sendLeaveRejectionEmail } = require('../services/emailService');
          await sendLeaveRejectionEmail({ organization: organizationObj, submitter, admin: { fullName: req.user.fullName, email: req.user.email }, leave, adminComment });
        }
      }
    } catch (emailErr) {
      console.error('Failed to send leave decision email:', emailErr);
    }

    // Notify the user whose request was actioned
    await notificationService.notifyUser({
      userId: leave.user,
      organization: leave.organization,
      message: `Your leave request has been ${status.toLowerCase()}.`,
      type: 'leave',
      link: '/my-leave-requests',
      sender: req.user._id
    });
  } else if (status === 'Pending') {
    leave.actionedBy = undefined;
  }
  await leave.save();
  res.json(leave);
});

// Get leave records for a staff member, filtered by month/year or from/to
exports.getLeaveRecords = async (req, res) => {
  try {
    const { staff, month, year, from, to } = req.query;
    let filter = {};
    if (staff) filter.user = staff;
    if (month && year) {
      // Filter by month and year
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.startDate = { $lte: end };
      filter.endDate = { $gte: start };
    } else if (from && to) {
      const fromDate = new Date(from + '-01');
      const toDate = new Date(to + '-31');
      filter.startDate = { $lte: toDate };
      filter.endDate = { $gte: fromDate };
    }
    const records = await LeaveRequest.find(filter)
      .populate('leaveType', 'name color icon')
      .select('startDate endDate leaveType status')
      .sort({ startDate: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave records' });
  }
};

// Admin: Get upcoming approved leaves
exports.getUpcomingApprovedLeaves = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get the organization ID - handle both populated and unpopulated references
  let organizationId;
  if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
    // Organization is already populated
    organizationId = req.user.organization._id;
  } else {
    // Organization is not populated, use the ID directly
    organizationId = req.user.organization;
  }
  
  // Get all approved leaves that are upcoming (startDate >= today OR endDate >= today)
  // This ensures we show all future approved leaves, not just those in the current month
  const leaves = await LeaveRequest.find({
    organization: organizationId,
    status: { $in: ['approved', 'Approved'] },
    $or: [
      { startDate: { $gte: today } },  // Leaves starting today or in the future
      { endDate: { $gte: today } }     // Leaves ending today or in the future (includes ongoing leaves)
    ]
  })
    .populate('user', 'fullName department profileImage status')
    .populate('leaveType', 'name color icon documentThreshold')
    .populate('attachments.uploadedBy', 'fullName')
    .sort({ startDate: 1 });
  
  // Filter out archived users
  const filteredLeaves = leaves.filter(leave => {
    return leave.user && 
           (typeof leave.user === 'object') && 
           leave.user.status !== 'archived';
  });
  
  // Convert profile images to signed URLs
  const processedLeaves = processProfileImagesInArray(filteredLeaves);
  res.json(processedLeaves);
}); 

