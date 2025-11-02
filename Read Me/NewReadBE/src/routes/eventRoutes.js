const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const multer = require('multer');
const { uploadToS3 } = require('../utils/s3');

// Import controllers
const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  approveEvent,
  rejectEvent,
  scheduleEvent,
  cancelEvent,
  updateEventTask,
  getPendingEvents,
  getApprovedEvents,
  getMyEvents
} = require('../controllers/eventController');

const {
  getEventTemplates,
  getEventTemplate,
  createEventTemplate,
  createTemplateFromEvent,
  updateEventTemplate,
  deleteEventTemplate,
  useEventTemplate,
  getTemplateCategories,
  getPopularTemplates,
  duplicateEventTemplate
} = require('../controllers/eventTemplateController');

const {
  getMyCalendar,
  generateICSFeed
} = require('../controllers/calendarController');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all event routes
// Events management is available for Professional and Enterprise plans only
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
router.use(checkSubscriptionStatus);
router.use(featureAccess('events_management'));

// Event routes (authentication, subscription, and feature access already applied)
router.get('/', permissions('Operations', 'view', 'Events'), getEvents);
router.get('/my', permissions('Operations', 'view', 'My Events'), getMyEvents);
router.get('/admin/pending', permissions('Operations', 'view', 'Approvals'), getPendingEvents);
router.get('/admin/approved', permissions('Operations', 'view', 'Approvals'), getApprovedEvents);
router.get('/templates', permissions('Operations', 'view', 'Templates'), getEventTemplates);
router.get('/templates/categories', permissions('Operations', 'view', 'Templates'), getTemplateCategories);
router.get('/templates/popular', permissions('Operations', 'view', 'Templates'), getPopularTemplates);
router.get('/templates/:id', permissions('Operations', 'view', 'Templates'), getEventTemplate);
router.post('/templates', permissions('Operations', 'full', 'Templates'), createEventTemplate);
router.post('/templates/from-event', permissions('Operations', 'full', 'Templates'), createTemplateFromEvent);
router.put('/templates/:id', permissions('Operations', 'full', 'Templates'), updateEventTemplate);
router.delete('/templates/:id', permissions('Operations', 'full', 'Templates'), deleteEventTemplate);
router.post('/templates/:id/use', permissions('Operations', 'view', 'Templates'), useEventTemplate);
router.post('/templates/:id/duplicate', permissions('Operations', 'full', 'Templates'), duplicateEventTemplate);
router.get('/calendar/my', getMyCalendar);
router.get('/calendar/ics/:userId/:token.ics', generateICSFeed);
router.get('/:id', permissions('Operations', 'view', 'Events'), getEvent);
router.post('/', upload.array('attachments', 10), permissions('Operations', 'full', 'Create Event'), createEvent);
router.post('/request', upload.array('attachments', 10), permissions('Operations', 'view', 'Request Event'), createEvent); // Alias for /events
router.put('/:id', permissions('Operations', 'full', 'Create Event'), updateEvent);
router.post('/:id/approve', permissions('Operations', 'full', 'Approvals'), approveEvent);
router.post('/:id/reject', permissions('Operations', 'full', 'Approvals'), rejectEvent);
router.post('/:id/schedule', permissions('Operations', 'full', 'Events'), scheduleEvent);
router.post('/:id/cancel', permissions('Operations', 'full', 'Events'), cancelEvent);
router.put('/:id/tasks/:taskId', permissions('Operations', 'full', 'Events'), updateEventTask);

// File upload route
router.post('/uploads', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = await uploadToS3(req.file, 'events');

    res.json({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      url: fileUrl,
      fileId: fileUrl, // Add fileId for compatibility
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

module.exports = router;