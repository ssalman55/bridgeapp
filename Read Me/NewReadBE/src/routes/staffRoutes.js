const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getStaffStats, createStaff, getAllStaff, updateStaff, deleteStaff, importStaffFromCSV, getActivePeers, adminSendPasswordResetLink, archiveStaff, unarchiveStaff, getUpcomingBirthdays } = require('../controllers/staffController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all staff routes
router.use(checkSubscriptionStatus);

// Custom middleware to allow access if user has either Staff Profiles or Create Staff permission
function staffSearchPermission(req, res, next) {
  // Try Staff Profiles first
  return permissions('People', 'view', 'Profiles')(req, res, function(err) {
    if (!err) return next();
    // If not, try Create Staff
    return permissions('People', 'view', 'Create')(req, res, next);
  });
}

// Protected routes (authentication and subscription already applied)
router.get('/stats', getStaffStats);
router.post('/create', permissions('People', 'full', 'Create'), createStaff);
router.get('/', staffSearchPermission, getAllStaff);
router.put('/:id', permissions('People', 'full', 'Profiles'), updateStaff);
router.delete('/:id', permissions('People', 'full', 'Profiles'), deleteStaff);
router.post('/import', permissions('People', 'full', 'Create'), upload.single('file'), importStaffFromCSV);
router.get('/active-peers', getActivePeers);
router.get('/birthdays/upcoming', staffSearchPermission, getUpcomingBirthdays);
router.post('/:id/send-reset-link', permissions('People', 'full', 'Profiles'), adminSendPasswordResetLink);

// Bulk delete staff members
router.post('/bulk-delete', permissions('People', 'full', 'Profiles'), deleteStaff);

router.post('/:id/archive', permissions('People', 'full', 'Profiles'), archiveStaff);
router.post('/:id/unarchive', permissions('People', 'full', 'Profiles'), unarchiveStaff);

module.exports = router; 