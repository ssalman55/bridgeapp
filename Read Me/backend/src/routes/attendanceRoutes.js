const express = require('express');
const router = express.Router();
const { protect, adminOrAcademicAdmin } = require('../middleware/authMiddleware');
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
  getAttendanceHistory
} = attendanceController;
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const Attendance = require('../models/Attendance');
const permissions = require('../middleware/permissions');
const Role = require('../models/Role');

// Base route: /api/attendance

// Staff routes
router.get('/status', protect, getAttendanceStatus);
router.get('/history', protect, getAttendanceHistory);
router.post('/checkin', protect, checkIn);
router.post('/checkout', protect, checkOut);
router.get('/today', protect, getTodayAttendance);

// Admin and Academic Admin routes
router.get('/all', protect, permissions('Attendance', 'view', 'Attendance Tracker'), getAllAttendance);
router.get('/today/present', protect, permissions('Attendance', 'view', "Today's Presents"), getTodayPresent);
router.get('/today/absent', protect, permissions('Attendance', 'view', "Today's Absents"), getTodayAbsent);
router.get('/monthly/absents', protect, permissions('Attendance', 'view', 'Monthly Absents'), getMonthlyAbsents);
router.post('/today/absent/send-email', protect, permissions('Attendance', 'full', "Today's Absents"), attendanceController.sendAbsenceEmails);

async function attachPermissions(req, res, next) {
  if (req.user && !req.user.permissions) {
    const roleDoc = await Role.findOne({ name: req.user.role });
    req.user.permissions = roleDoc ? roleDoc.permissions : {};
  }
  next();
}

router.get(
  '/staff-report/:staffId',
  authenticateToken,
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