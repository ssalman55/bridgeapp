const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getStaffStats, createStaff, getAllStaff, updateStaff, deleteStaff, importStaffFromCSV, getActivePeers, adminSendPasswordResetLink, archiveStaff, unarchiveStaff } = require('../controllers/staffController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
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

// Custom middleware to allow access if user has either Staff Profiles or Create Staff permission
function staffSearchPermission(req, res, next) {
  // Try Staff Profiles first
  return permissions('Staff Management', 'view', 'Staff Profiles')(req, res, function(err) {
    if (!err) return next();
    // If not, try Create Staff
    return permissions('Staff Management', 'view', 'Create Staff')(req, res, next);
  });
}

// Protected routes (require authentication)
router.get('/stats', authenticateToken, getStaffStats);
router.post('/create', authenticateToken, authorizeAdmin, createStaff);
router.get('/', authenticateToken, staffSearchPermission, getAllStaff);
router.put('/:id', authenticateToken, authorizeAdmin, updateStaff);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteStaff);
router.post('/import', authenticateToken, authorizeAdmin, upload.single('file'), importStaffFromCSV);
router.get('/active-peers', authenticateToken, getActivePeers);
router.post('/:id/send-reset-link', authenticateToken, authorizeAdmin, adminSendPasswordResetLink);

// Bulk delete staff members
router.post('/bulk-delete', authenticateToken, authorizeAdmin, deleteStaff);

router.post('/:id/archive', authenticateToken, authorizeAdmin, archiveStaff);
router.post('/:id/unarchive', authenticateToken, authorizeAdmin, unarchiveStaff);

module.exports = router; 