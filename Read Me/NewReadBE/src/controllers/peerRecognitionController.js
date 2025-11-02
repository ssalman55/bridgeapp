const PeerRecognition = require('../models/PeerRecognition');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const { sendPeerRecognitionEmail } = require('../services/emailService');
const Organization = require('../models/Organization');

// Staff: Submit a recognition
exports.submitRecognition = async (req, res) => {
  try {
    const { comment, recognized } = req.body;
    
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    const recognition = new PeerRecognition({
      submitter: req.user._id,
      recognized: recognized || undefined,
      comment,
      status: 'pending',
      organization: organizationId,
    });
    await recognition.save();

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
      console.error('Organization not found for peer recognition:', organizationId);
      return res.status(500).json({ message: 'Organization not found' });
    }

    // Get recognized user details - ensure they belong to the same organization
    const recognizedUser = await User.findOne({ 
      _id: recognized, 
      organization: organizationId 
    });
    
    if (!recognizedUser) {
      console.error('Recognized user not found or not in same organization:', recognized);
      return res.status(400).json({ message: 'Recognized user not found or not in your organization' });
    }

    // Notify all admins in the SAME organization only - ensure tenant isolation
    const admins = await User.find({ 
      organization: organizationId, 
      role: 'admin', 
      status: { $ne: 'archived' } 
    });
    
    console.log(`Found ${admins.length} admins in organization ${organization.name} (${organizationId})`);
    
    const staffName = req.user.fullName;
    const message = `${staffName} submitted a peer recognition`;
    const link = '/admin/peer-recognitions';
    
    // Create in-app notifications for admins in the same organization
    await Promise.all(admins.map(admin => Notification.create({
      message,
      type: 'peer',
      link,
      recipient: admin._id,
      sender: req.user._id,
      organization: organizationId
    })));

    // Send SMTP emails to all admins in the same organization only
    if (admins.length > 0 && organization && recognizedUser) {
      try {
        console.log(`Sending peer recognition emails to ${admins.length} admins in organization: ${organization.name} (${organizationId})`);
        
        const emailResult = await sendPeerRecognitionEmail({
          organization,
          admins,
          submitter: {
            fullName: req.user.fullName,
            email: req.user.email
          },
          recognized: {
            fullName: recognizedUser.fullName,
            email: recognizedUser.email
          },
          comment
        });
        
        console.log('Peer recognition emails sent successfully:', {
          organization: organization.name,
          organizationId: organizationId,
          totalSent: emailResult.totalSent,
          totalFailed: emailResult.totalFailed,
          successfulEmails: emailResult.successfulEmails,
          failedEmails: emailResult.failedEmails
        });
      } catch (emailError) {
        console.error('Failed to send peer recognition emails:', emailError);
        // Don't fail the request if email sending fails
      }
    } else {
      console.log('No admins found in organization or missing data:', {
        adminsCount: admins.length,
        hasOrganization: !!organization,
        hasRecognizedUser: !!recognizedUser,
        organizationId: organizationId
      });
    }

    res.status(201).json({ message: 'Recognition submitted for review.', recognition });
  } catch (err) {
    console.error('Error in submitRecognition:', err);
    res.status(500).json({ message: 'Failed to submit recognition', error: err.message });
  }
};

// List recognitions
exports.listRecognitions = async (req, res) => {
  try {
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    let filter = { organization: organizationId };
    const { status, page = 1, limit = 10 } = req.query;

    if (status) {
      filter.status = status;
    } else if (req.user.role !== 'admin') {
      // Staff default: only approved
      filter.status = 'approved';
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await PeerRecognition.countDocuments(filter);

    // Get paginated recognitions
    const recognitions = await PeerRecognition.find(filter)
      .populate('submitter', 'fullName email')
      .populate('recognized', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Return paginated response
    res.json({
      recognitions,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recognitions', error: err.message });
  }
};

// Admin: Approve recognition
exports.approveRecognition = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    const { id } = req.params;
    const recognition = await PeerRecognition.findOne({ 
      _id: id, 
      organization: organizationId 
    });
    
    if (!recognition) return res.status(404).json({ message: 'Recognition not found' });
    
    recognition.status = 'approved';
    recognition.adminNote = '';
    await recognition.save();

    // Fetch submitter and recognized users; ensure both are in the same organization (tenant isolation)
    const [submitterUser, recognizedUser] = await Promise.all([
      User.findOne({ _id: recognition.submitter, organization: organizationId }).select('fullName email organization'),
      User.findOne({ _id: recognition.recognized, organization: organizationId }).select('fullName email organization'),
    ]);

    // Get organization details (handle populated/unpopulated req.user.organization)
    const organization = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
      ? req.user.organization
      : await Organization.findById(organizationId).select('name');

    // Send SMTP email ONLY to the submitter if the submitter is in the same organization
    if (organization && submitterUser) {
      try {
        const { sendPeerRecognitionApprovalEmail } = require('../services/emailService');
        await sendPeerRecognitionApprovalEmail({
          organization,
          submitter: submitterUser,
          recognized: recognizedUser || { fullName: 'Peer' },
          admin: { fullName: req.user.fullName, email: req.user.email },
          comment: recognition.comment,
        });
      } catch (emailErr) {
        console.error('Failed to send peer recognition approval email:', emailErr);
      }
    }
    
    // Notify the submitter whose recognition was approved (in-app)
    await notificationService.notifyUser({
      userId: recognition.submitter,
      organization: organizationId,
      message: 'Your peer recognition has been approved.',
      type: 'peer',
      link: '/peer-recognition',
      sender: req.user._id
    });
    res.json({ message: 'Recognition approved', recognition });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve recognition', error: err.message });
  }
};

// Admin: Reject recognition
exports.rejectRecognition = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    const { id } = req.params;
    const { adminNote } = req.body;
    const recognition = await PeerRecognition.findOne({ 
      _id: id, 
      organization: organizationId 
    });
    
    if (!recognition) return res.status(404).json({ message: 'Recognition not found' });
    
    recognition.status = 'rejected';
    recognition.adminNote = adminNote || '';
    await recognition.save();

    // Email the submitter with strict tenant isolation
    try {
      const submitterUser = await User.findOne({ _id: recognition.submitter, organization: organizationId }).select('fullName email organization');
      const recognizedUser = await User.findOne({ _id: recognition.recognized, organization: organizationId }).select('fullName email organization');
      const organization = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
        ? req.user.organization
        : await Organization.findById(organizationId).select('name');
      if (submitterUser && organization) {
        const { sendPeerRecognitionRejectionEmail } = require('../services/emailService');
        await sendPeerRecognitionRejectionEmail({
          organization,
          submitter: submitterUser,
          admin: { fullName: req.user.fullName, email: req.user.email },
          recognized: recognizedUser,
          adminNote
        });
      }
    } catch (emailErr) {
      console.error('Failed to send peer recognition rejection email:', emailErr);
    }
    
    // Notify the submitter whose recognition was rejected
    await notificationService.notifyUser({
      userId: recognition.submitter,
      organization: organizationId,
      message: 'Your peer recognition has been rejected.',
      type: 'peer',
      link: '/peer-recognition',
      sender: req.user._id
    });
    res.json({ message: 'Recognition rejected', recognition });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject recognition', error: err.message });
  }
}; 