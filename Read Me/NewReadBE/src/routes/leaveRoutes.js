const express = require('express');
const multer = require('multer');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all leave routes
router.use(checkSubscriptionStatus);

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
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed.'), false);
    }
  }
});

// Staff: submit leave request (with optional file uploads)
router.post('/', (req, res, next) => {
  upload.array('attachments', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum size is 10MB per file.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ message: 'Too many files. Maximum 5 files allowed.' });
        }
        return res.status(400).json({ message: err.message });
      }
      // File filter error
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, leaveController.submitLeaveRequest);

// Staff: view their own leave requests
router.get('/my', leaveController.getMyLeaveRequests);

// Admin/Academic Admin: view all leave requests
router.get('/', permissions('Attendance', 'view', 'Leave Management'), leaveController.getAllLeaveRequests);

// Admin/Academic Admin: approve/reject leave request
router.patch('/:id', permissions('Attendance', 'full', 'Leave Management'), leaveController.updateLeaveStatus);
router.put('/:id', permissions('Attendance', 'full', 'Leave Management'), leaveController.updateLeaveStatus);

// Admin: get leave records for a staff member (for Leave Tracker)
router.get('/leave-records', permissions('Attendance', 'view', 'Leave Tracker'), leaveController.getLeaveRecords);

// Admin: get upcoming approved leaves
router.get('/upcoming-approved', permissions('Attendance', 'view', 'Upcoming Leaves'), leaveController.getUpcomingApprovedLeaves);

module.exports = router; 