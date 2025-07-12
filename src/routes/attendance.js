const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAllAttendance
} = require('../controllers/attendanceController');

router.post('/checkin', protect, checkIn);
router.post('/checkout', protect, checkOut);
router.get('/today', protect, getTodayAttendance);
router.get('/all', protect, admin, getAllAttendance);

module.exports = router; 