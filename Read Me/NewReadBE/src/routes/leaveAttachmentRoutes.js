const express = require('express');
const multer = require('multer');
const { protect, permissions } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { uploadToS3, getSignedUrl } = require('../utils/s3');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');

const router = express.Router();

// Configure multer for memory storage (S3 uploads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'), false);
    }
  }
});

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(protect);

// Apply subscription middleware to all leave attachment routes
router.use(checkSubscriptionStatus);

// Upload document to leave request (authentication and subscription already applied)
router.post('/upload/:leaveRequestId', upload.array('attachments', 5), async (req, res) => {
  try {
    const { leaveRequestId } = req.params;
    const { documentType = 'other' } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organization;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      user: userId,
      organization: organizationId
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Check if leave request is still pending (can't modify approved/rejected requests)
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ 
        message: 'Cannot upload documents to approved or rejected leave requests' 
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const processedAttachments = [];

    // Process each uploaded file
    for (const file of req.files) {
      // Generate unique filename with organization isolation
      const fileExtension = file.originalname.split('.').pop();
      const timestamp = Date.now();
      const uniqueFilename = `leave-${leaveRequestId}-${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      
      // Upload to S3 with organization isolation
      const s3Key = `organizations/${organizationId}/leave-attachments/${leaveRequestId}/${uniqueFilename}`;
      const fileUrl = await uploadToS3(file, s3Key);

      processedAttachments.push({
        filename: uniqueFilename,
        originalName: file.originalname,
        url: fileUrl,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
        documentType: documentType,
        uploadedAt: new Date()
      });
    }

    // Add attachments to leave request
    leaveRequest.attachments.push(...processedAttachments);
    await leaveRequest.save();

    res.status(201).json({
      message: 'Documents uploaded successfully',
      attachments: processedAttachments
    });

  } catch (error) {
    console.error('Error uploading leave documents:', error);
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error uploading documents' });
  }
});

// Remove document from leave request
router.delete('/remove/:leaveRequestId/:attachmentId', async (req, res) => {
  try {
    const { leaveRequestId, attachmentId } = req.params;
    const userId = req.user._id;
    const organizationId = req.user.organization;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      user: userId,
      organization: organizationId
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Check if leave request is still pending
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ 
        message: 'Cannot remove documents from approved or rejected leave requests' 
      });
    }

    // Find and remove the attachment
    const attachmentIndex = leaveRequest.attachments.findIndex(
      attachment => attachment._id.toString() === attachmentId
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Remove the attachment
    leaveRequest.attachments.splice(attachmentIndex, 1);
    await leaveRequest.save();

    res.json({ message: 'Document removed successfully' });

  } catch (error) {
    console.error('Error removing leave document:', error);
    res.status(500).json({ message: 'Error removing document' });
  }
});

// Download document (signed URL)
router.get('/download/:leaveRequestId/:attachmentId', async (req, res) => {
  try {
    const { leaveRequestId, attachmentId } = req.params;
    const userId = req.user._id;
    const organizationId = req.user.organization;
    const userRole = req.user.role;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      organization: organizationId
    }).populate('leaveType', 'name documentThreshold');

    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Check access permissions
    const canAccess = userRole === 'admin' || 
                     userRole === 'hr_manager' || 
                     leaveRequest.user.toString() === userId.toString();

    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find the attachment
    const attachment = leaveRequest.attachments.find(
      att => att._id.toString() === attachmentId
    );

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Extract S3 key from URL - using the same pattern as working examples (documentRoutes.js, taskRoutes.js)
    let s3Key;
    
    console.log('Attachment URL:', attachment.url);
    console.log('Attachment filename:', attachment.filename);
    
    if (attachment.url && typeof attachment.url === 'string') {
      if (attachment.url.startsWith('http')) {
        // For HTTP URLs, extract the S3 key using the proven pattern from documentRoutes.js
        try {
          const match = attachment.url.match(/amazonaws\.com\/(.+?)(?:\?|$)/);
          if (match) {
            s3Key = decodeURIComponent(match[1]);
            console.log('Extracted S3 key from URL:', s3Key);
          } else {
            // Alternative: use pathname (from taskRoutes.js pattern)
            try {
              const urlObj = new URL(attachment.url);
              const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
              // For virtual-hosted style (bucket.s3.region.amazonaws.com/key), pathname is just /key
              // For path-style (s3.region.amazonaws.com/bucket/key), pathname is /bucket/key - we need to skip bucket
              // Since we're using virtual-hosted style, just use the pathname without leading slash
              s3Key = pathParts.join('/');
              if (s3Key) {
                s3Key = decodeURIComponent(s3Key);
                console.log('Extracted S3 key from pathname:', s3Key);
              }
            } catch (urlError) {
              console.warn('Failed to parse URL:', urlError.message);
            }
          }
        } catch (e) {
          console.error('Error extracting S3 key from URL:', e);
        }
      } else {
        // If it's not an HTTP URL, treat it as an S3 key directly
        s3Key = attachment.url;
        console.log('Using URL as S3 key directly:', s3Key);
      }
    }
    
    // Fallback: Construct S3 key from known pattern if URL extraction failed
    // ONLY use fallback if we couldn't extract from URL AND URL doesn't look like an S3 URL
    if (!s3Key && attachment.filename && (!attachment.url || !attachment.url.includes('amazonaws.com'))) {
      // Only construct if we have a filename and the URL wasn't a valid S3 URL
      s3Key = `organizations/${organizationId}/leave-attachments/${leaveRequestId}/${attachment.filename}`;
      console.log('Constructed S3 key from pattern (fallback):', s3Key);
    }
    
    if (!s3Key) {
      console.error('No S3 key could be determined. Attachment:', {
        url: attachment.url,
        filename: attachment.filename,
        attachmentId,
        leaveRequestId
      });
      return res.status(400).json({ 
        message: 'Invalid attachment: missing URL and filename. Attachment may not have been properly uploaded.' 
      });
    }
    
    // Validate S3 key doesn't contain malformed data
    if (s3Key.includes('{') || s3Key.includes('dataSharingConfig')) {
      console.error('S3 key contains malformed data:', s3Key);
      return res.status(400).json({ 
        message: 'Invalid attachment URL format.' 
      });
    }
    
    // Final validation: ensure S3 key doesn't exceed 1024 bytes
    const keyLengthInBytes = Buffer.byteLength(s3Key, 'utf8');
    if (keyLengthInBytes > 1024) {
      console.error('S3 key exceeds 1024 bytes:', {
        keyLength: keyLengthInBytes,
        key: s3Key.substring(0, 100) + '...',
        attachmentId,
        leaveRequestId
      });
      return res.status(400).json({ 
        message: 'Attachment S3 key is too long. Please contact support.' 
      });
    }

    console.log('Final S3 key:', s3Key);
    // Generate signed URL (1 hour expiry)
    const signedUrl = getSignedUrl(s3Key, 3600);
    console.log('Generated signed URL');

    res.json({ 
      downloadUrl: signedUrl,
      filename: attachment.originalName,
      mimeType: attachment.mimeType
    });

  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ message: 'Error generating download URL' });
  }
});

// Get leave type threshold information
router.get('/threshold/:leaveTypeId', async (req, res) => {
  try {
    const { leaveTypeId } = req.params;
    const organizationId = req.user.organization;

    const leaveType = await LeaveType.findOne({
      _id: leaveTypeId,
      organization: organizationId,
      isActive: true,
      isDeleted: false
    });

    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    res.json({
      documentThreshold: leaveType.documentThreshold,
      name: leaveType.name
    });

  } catch (error) {
    console.error('Error fetching leave type threshold:', error);
    res.status(500).json({ message: 'Error fetching threshold information' });
  }
});

module.exports = router;










