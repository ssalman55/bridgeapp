const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
console.log('attendanceController keys:', Object.keys(attendanceController));
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAllAttendance,
  getTodayPresent,
  getTodayAbsent,
  getMonthlyAbsents,
  getAttendanceStatus,
  getAttendanceHistory,
  getAllStaffAttendanceStatus
} = attendanceController;
const { authenticateToken } = require('../middleware/authMiddleware');
const Attendance = require('../models/Attendance');
const permissions = require('../middleware/permissions');
const Role = require('../models/Role');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all attendance routes
router.use(checkSubscriptionStatus);

// Base route: /api/attendance

// Staff routes (authentication and subscription already applied)
router.get('/status', getAttendanceStatus);
router.get('/history', getAttendanceHistory);
router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.get('/today', getTodayAttendance);

// Admin and Academic Admin routes
router.get('/all', permissions('Attendance', 'view', 'Attendance Tracker'), getAllAttendance);
router.get('/today/present', permissions('Attendance', 'view', "Today's Presents"), getTodayPresent);
router.get('/today/absent', permissions('Attendance', 'view', "Today's Absents"), getTodayAbsent);
router.get('/monthly/absents', permissions('Attendance', 'view', 'Monthly Absents'), getMonthlyAbsents);
router.get('/all-staff-status', permissions('Attendance', 'view', 'Attendance Tracker'), getAllStaffAttendanceStatus);
router.post('/today/absent/send-email', permissions('Attendance', 'full', "Today's Absents"), attendanceController.sendAbsenceEmails);

async function attachPermissions(req, res, next) {
  if (req.user && !req.user.permissions) {
    const roleName = req.user.role ? req.user.role.toLowerCase() : '';
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    const roleDoc = await Role.findOne({ 
      name: new RegExp('^' + roleName + '$', 'i'),
      organization: organizationId 
    });
    req.user.permissions = roleDoc ? roleDoc.permissions : {};
  }
  next();
}

router.get(
  '/staff-report/:staffId',
  attachPermissions,
  (req, res, next) => {
    const permissions = req.user.permissions || {};
    const hasAttendanceTracker =
      permissions['Attendance']?.['Attendance Tracker'] === 'view' ||
      permissions['Attendance']?.['Attendance Tracker'] === 'full';
    const hasStaffProfiles =
      permissions['Staff Management']?.['Staff Profiles'] === 'view' ||
      permissions['Staff Management']?.['Staff Profiles'] === 'full';
    const hasCreateStaff =
      permissions['Staff Management']?.['Create Staff'] === 'view' ||
      permissions['Staff Management']?.['Create Staff'] === 'full';
    if (
      (req.user?.role && req.user.role !== 'staff') ||
      hasAttendanceTracker ||
      hasStaffProfiles ||
      hasCreateStaff
    ) {
      return next();
    }
    return res.status(403).json({ message: 'Insufficient permission for staff attendance report' });
  },
  attendanceController.getIndividualStaffReport
);

module.exports = router; 