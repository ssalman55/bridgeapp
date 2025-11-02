const express = require('express');
const router = express.Router();
const trainingRequestController = require('../controllers/trainingRequestController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const multer = require('multer');
const permissions = require('../middleware/permissions');

// Multer setup for file upload using memory storage (for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all training request routes
// Training management is available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('training_management'));

// Staff: Create or update (draft/submit)
router.post('/', upload.single('attachment'), trainingRequestController.createOrUpdateRequest);
// Staff: Get my requests
router.get('/my', trainingRequestController.getMyRequests);
// Admin: List all requests
router.get('/admin', permissions('Learning', 'view', 'Requests'), trainingRequestController.getAllRequests);
// Admin: Approve/reject
router.patch('/:id/decision', permissions('Learning', 'full'), trainingRequestController.approveOrReject);
// Admin: Approved requests
router.get('/admin/approved', permissions('Learning', 'view', 'Approved'), trainingRequestController.getApprovedRequests);
// Admin: Training cost summary
router.get('/admin/costs', permissions('Learning', 'full', 'Cost'), trainingRequestController.getTrainingCosts);
// Admin: Rejected requests
router.get('/admin/rejected', permissions('Learning', 'view', 'Rejected'), trainingRequestController.getRejectedRequests);

// Download attachment with signed URL (must be before /:id route)
router.get('/:id/attachment/download', async (req, res) => {
  try {
    const TrainingRequest = require('../models/TrainingRequest');
    const { getSignedUrl } = require('../utils/s3');
    
    const request = await TrainingRequest.findById(req.params.id);
    if (!request || !request.attachment || !request.attachment.url) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    // Check access permissions - staff can download their own, admins can download any in their org
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    
    const requestOrgId = request.organization && typeof request.organization === 'object' && request.organization._id
      ? request.organization._id
      : request.organization;
    
    if (requestOrgId.toString() !== organizationId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const canAccess = req.user.role === 'admin' || 
                     req.user.role === 'hr_manager' ||
                     request.staffId.toString() === req.user._id.toString();
    
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Extract S3 key from URL or use stored s3Key
    let s3Key;
    if (request.attachment.s3Key) {
      s3Key = request.attachment.s3Key;
    } else if (request.attachment.url && request.attachment.url.startsWith('http')) {
      // Handle S3 URLs with proper decoding
      try {
        const url = new URL(request.attachment.url);
        const pathParts = url.pathname.split('/');
        // Remove the first empty element and get the rest
        s3Key = pathParts.slice(1).join('/');
        // Decode URL-encoded characters
        s3Key = decodeURIComponent(s3Key);
      } catch (urlError) {
        // Try alternative extraction method
        const match = request.attachment.url.match(/amazonaws\.com\/(.+)$/);
        s3Key = match ? decodeURIComponent(match[1]) : null;
      }
    } else {
      // Handle old local file paths (for migration purposes)
      s3Key = request.attachment.url.replace(/^\/uploads\//, 'training/');
    }
    
    if (!s3Key) {
      console.error('Training request attachment S3 key extraction failed:', request.attachment.url);
      return res.status(400).json({ message: 'Invalid attachment URL' });
    }
    
    // Generate signed URL (1 hour expiry)
    const signedUrl = getSignedUrl(s3Key, 3600);
    
    res.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error('Error generating training request attachment signed URL:', error);
    res.status(500).json({ message: 'Failed to generate download link', error: error.message });
  }
});

// Get request by ID
router.get('/:id', trainingRequestController.getRequestById);
// Delete request by ID
router.delete('/:id', trainingRequestController.deleteRequest);

module.exports = router; 