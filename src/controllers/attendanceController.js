const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Geofence = require('../models/Geofence');
const GeofenceSettings = require('../models/GeofenceSettings');
const asyncHandler = require('express-async-handler');
const { sendAbsenceNotificationEmail } = require('../utils/welcomeEmail');
const notificationService = require('../services/notificationService');

// Check in
const checkIn = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Require latitude and longitude in request body
  const { latitude, longitude } = req.body;
  if (latitude == null || longitude == null) {
    return res.status(400).json({ message: 'Location is required for check-in.' });
  }

  // Check geofence settings
  const geofenceSettings = await GeofenceSettings.findOne({ 
    organization: req.user.organization._id || req.user.organization 
  });
  
  let geofenceStatus = 'not_applicable';
  
  // Debug logging
  console.log('Geofence settings:', geofenceSettings);
  console.log('User organization:', req.user.organization);
  console.log('User organization ID:', req.user.organization?._id);
  console.log('User organization ID string:', req.user.organization?._id?.toString());
  
  // If geofencing is enabled, verify location
  if (geofenceSettings?.isEnabled) {
    console.log('Geofencing is enabled');
    // Fetch all geofences for the user's organization
    const geofences = await Geofence.find({ 
      organization: req.user.organization._id || req.user.organization 
    });
    
    console.log('Found geofences:', geofences.length);
    
    if (geofences.length > 0) {
      // Check if user is within any geofence
      const isWithinGeofence = geofences.some(geofence => {
        const distance = haversineDistance(latitude, longitude, geofence.latitude, geofence.longitude);
        return distance <= geofence.radius;
      });

      if (isWithinGeofence) {
        geofenceStatus = 'inside';
        console.log('User is within geofence');
      } else {
        geofenceStatus = 'outside';
        console.log('User is outside geofence');
        console.log('allowCheckInOutside:', geofenceSettings.allowCheckInOutside);
        
        // If allowCheckInOutside is false, block the check-in
        // Use fallback to false if the field doesn't exist (for backward compatibility)
        if (!(geofenceSettings.allowCheckInOutside ?? false)) {
          const geofenceNames = geofences.map(g => g.name).join(', ');
          console.log('Blocking check-in - user outside geofence and allowCheckInOutside is false');
          return res.status(403).json({ 
            message: `You must be at ${geofenceNames} to check in.` 
          });
        } else {
          console.log('Allowing check-in - user outside geofence but allowCheckInOutside is true');
        }
      }
    } else {
      // No geofences configured but geofencing is enabled
      // If no geofences exist, user cannot be "outside" any geofence, so allow check-in
      // but still set status as 'not_applicable' since no geofences are configured
      geofenceStatus = 'not_applicable';
      console.log('No geofences found - allowing check-in with not_applicable status');
    }
  } else {
    console.log('Geofencing is disabled or no settings found');
  }
  const existingAttendance = await Attendance.findOne({
    user: req.user._id,
    checkIn: {
      $gte: today,
      $lt: tomorrow
    }
  }).sort({ checkIn: -1 });

  // Allow new check-in if no record exists or last record is checked out
  if (!existingAttendance || existingAttendance.checkOut) {
    console.log('Creating attendance record with geofenceStatus:', geofenceStatus);
    const attendance = await Attendance.create({
      user: req.user._id,
      organization: req.user.organization._id,
      date: today,
      checkIn: new Date(),
      location: { latitude, longitude },
      geofenceStatus: geofenceStatus
    });
    return res.status(201).json(attendance);
  }

  // If there's an active check-in without checkout
  return res.status(400).json({ message: 'Please check out first before checking in again' });
});

// Haversine formula to calculate distance between two lat/lng points in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check out
const checkOut = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the latest attendance record for today
  const attendance = await Attendance.findOne({
    user: req.user._id,
    checkIn: {
      $gte: today,
      $lt: tomorrow
    },
    checkOut: null // Only find records that haven't been checked out
  }).sort({ checkIn: -1 });

  if (!attendance) {
    return res.status(400).json({ message: 'No active check-in found' });
  }

  // Calculate hours worked
  const checkInTime = new Date(attendance.checkIn);
  const checkOutTime = new Date();
  const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

  attendance.checkOut = checkOutTime;
  attendance.totalHours = parseFloat(hoursWorked.toFixed(2));
  await attendance.save();

  res.json(attendance);
});

// Get today's attendance
const getTodayAttendance = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the latest attendance record for today
  const attendance = await Attendance.findOne({
    user: req.user._id,
    checkIn: {
      $gte: today,
      $lt: tomorrow
    }
  }).sort({ checkIn: -1 });

  res.json(attendance || null);
});

// Get all attendance records (admin only)
const getAllAttendance = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  let query = {
    organization: req.user.organization._id // Filter by organization
  };

  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const attendance = await Attendance.find(query)
    .populate('user', 'fullName department position')
    .sort({ date: -1, checkIn: -1 });

  res.json(attendance);
});

// Get today's present staff (admin only)
const getTodayPresent = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const presentStaff = await Attendance.find({
    organization: req.user.organization._id, // Filter by organization
    date: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    }
  })
  .populate('user', 'fullName email department position profileImage')
  .sort({ checkIn: -1 });

  // Group by user and take the latest record
  const latestRecords = new Map();
  presentStaff.forEach(record => {
    if (!latestRecords.has(record.user._id.toString())) {
      latestRecords.set(record.user._id.toString(), record);
    }
  });

  const formattedStaff = Array.from(latestRecords.values()).map(record => ({
    id: record.user._id,
    name: record.user.fullName,
    email: record.user.email,
    department: record.user.department,
    profileImage: record.user.profileImage,
    checkInTime: record.checkIn,
    checkOutTime: record.checkOut,
    status: record.checkOut ? 'Checked Out' : 'Present'
  }));

  res.json(formattedStaff);
});

// Get today's absent staff (admin only)
const getTodayAbsent = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all users who don't have an attendance record for today
  const presentUserIds = await Attendance.find({
    date: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    },
    organization: req.user.organization._id, // Filter by organization
    status: { $ne: 'archived' }
  }).distinct('user');

  const absentStaff = await User.find({
    _id: { $nin: presentUserIds },
    organization: req.user.organization._id, // Filter by organization
    status: { $ne: 'archived' }
  }).select('fullName email department position profileImage');

  const formattedStaff = absentStaff.map(user => ({
    id: user._id,
    name: user.fullName,
    email: user.email,
    department: user.department,
    profileImage: user.profileImage,
    status: 'Absent'
  }));

  res.json(formattedStaff);
});

// Get monthly absents (admin only)
const getMonthlyAbsents = asyncHandler(async (req, res) => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get all working days in the month (excluding weekends)
  const workingDays = [];
  for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) { // Skip Saturday and Sunday
      workingDays.push(new Date(d));
    }
  }

  // Get all attendance records for the month (organization-scoped)
  const monthlyAttendance = await Attendance.find({
    organization: req.user.organization._id, // Filter by organization
    date: {
      $gte: firstDayOfMonth,
      $lte: lastDayOfMonth
    }
  }).populate('user', 'fullName email department position profileImage');

  // Get all users except admins (organization-scoped)
  const allUsers = await User.find({ 
    organization: req.user.organization._id, // Filter by organization
    status: { $ne: 'archived' }
  }).select('fullName email department position profileImage');

  // Calculate absents for each user
  const monthlyAbsents = allUsers.map(user => {
    // Group attendance by date to count unique days
    const uniqueDays = new Set(
      monthlyAttendance
        .filter(record => record.user._id.toString() === user._id.toString())
        .map(record => record.date.toISOString().split('T')[0])
    );

    const absentDays = workingDays.length - uniqueDays.size;

    return {
      id: user._id,
      name: user.fullName,
      email: user.email,
      department: user.department,
      profileImage: user.profileImage,
      absentDays,
      workingDays: workingDays.length,
      attendancePercentage: ((uniqueDays.size / workingDays.length) * 100).toFixed(1)
    };
  });

  res.json(monthlyAbsents);
});

// Get attendance status
const getAttendanceStatus = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the latest attendance record for today
  const attendance = await Attendance.findOne({
    user: req.user._id,
    checkIn: {
      $gte: today,
      $lt: tomorrow
    }
  }).sort({ checkIn: -1 });

  const status = {
    isCheckedIn: false,
    isCheckedOut: false,
    lastCheckIn: null,
    lastCheckOut: null,
    geofenceStatus: null
  };

  if (attendance) {
    status.isCheckedIn = true;
    status.isCheckedOut = !!attendance.checkOut;
    status.lastCheckIn = attendance.checkIn;
    status.lastCheckOut = attendance.checkOut;
    status.geofenceStatus = attendance.geofenceStatus || null;
  }

  res.json(status);
});

const getAttendanceHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const attendanceHistory = await Attendance.find({ user: userId })
    .sort({ date: -1 })
    .select('date checkIn checkOut totalHours')
    .limit(30); // Get last 30 records
    
  res.json(attendanceHistory);
});

// Get individual staff attendance report for a month (admin only)
const getIndividualStaffReport = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { month } = req.query; // month in YYYY-MM
    if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return res.status(400).json({ message: 'Invalid or missing month (expected YYYY-MM)' });
    }
    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 1);
    // Fetch all attendance records for the staff in the month
    const attendance = await Attendance.find({
      user: staffId,
      date: { $gte: start, $lt: end }
    }).sort({ date: 1, checkIn: 1 });
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const report = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day);
      // Find all attendance records for this day
      const records = attendance.filter(a => a.date.getDate() === day);
      let status = 'absent';
      let sessions = [];
      if (records.length > 0) {
        status = 'present';
        sessions = records.map(r => ({
          checkIn: r.checkIn,
          checkOut: r.checkOut
        }));
      }
      report.push({
        day,
        date: date.toISOString().slice(0, 10),
        status,
        sessions
      });
    }
    res.json({ staffId, month, report });
  } catch (error) {
    console.error('Error fetching staff attendance report:', error);
    res.status(500).json({ message: 'Error fetching staff attendance report', error: error.message });
  }
};

// Send absence notification emails to selected users
const sendAbsenceEmails = asyncHandler(async (req, res) => {
  const { userIds, date, reason } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'No users selected.' });
  }
  // Fetch user info
  const users = await User.find({ _id: { $in: userIds } }).select('fullName email');
  if (!users.length) {
    return res.status(404).json({ message: 'No users found.' });
  }
  // Prepare user data for email utility
  const userList = users.map(u => ({ email: u.email, name: u.fullName }));
  try {
    const results = await sendAbsenceNotificationEmail(userList, date, reason);
    // Generate notifications for selected staff
    await notificationService.notifyUsers({
      userIds,
      organization: req.user.organization._id || req.user.organization,
      message: `You have received an absence notification for ${date || 'today'}.`,
      type: 'attendance',
      link: '/attendance-history',
      sender: req.user._id
    });
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send emails', error: err.message });
  }
});

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAllAttendance,
  getTodayPresent,
  getTodayAbsent,
  getMonthlyAbsents,
  getAttendanceStatus,
  getAttendanceHistory,
  getIndividualStaffReport,
  sendAbsenceEmails
}; 