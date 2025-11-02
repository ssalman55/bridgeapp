const Attendance = require('../models/Attendance');
const User = require('../models/User');
const AuthorizedNetwork = require('../models/AuthorizedNetwork');
const Geofence = require('../models/Geofence');
const GeofenceSettings = require('../models/GeofenceSettings');
const Organization = require('../models/Organization');
const { hasFeatureAccess } = require('../middleware/featureAccessMiddleware');
const asyncHandler = require('express-async-handler');
// const { sendAbsenceNotificationEmail } = require('../utils/welcomeEmail'); // Commented out SendGrid implementation
const { sendAbsenceNotificationEmail } = require('../services/emailService'); // New SMTP implementation
const notificationService = require('../services/notificationService');
const { getSignedUrl } = require('../utils/s3');

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
  const geofenceSettings = await GeofenceSettings.findOne({ organization: req.user.organization });
  let geofenceStatus = 'not_applicable';
  let isWithinGeofence = false;

  if (geofenceSettings?.isEnabled) {
    // Verify that the organization's plan supports geofencing
    const organization = await Organization.findById(req.user.organization?._id || req.user.organization);
    if (!organization) {
      return res.status(403).json({ message: 'Organization not found' });
    }

    const plan = organization.plan || 'basic';
    if (!hasFeatureAccess(plan, 'geofencing_attendance')) {
      return res.status(403).json({
        success: false,
        message: 'Geofencing attendance is not available in the Basic plan. Please upgrade to Professional or Enterprise plan to use geofencing features.',
        code: 'FEATURE_NOT_AVAILABLE',
        requiredPlan: 'professional',
        currentPlan: plan
      });
    }
    // Fetch all geofences for the user's organization
    const geofences = await Geofence.find({ organization: req.user.organization });
    if (!geofences.length) {
      return res.status(403).json({ message: 'No authorized check-in locations are configured.' });
    }
    // Check if user is within any geofence
    isWithinGeofence = geofences.some(geofence => {
      const distance = haversineDistance(latitude, longitude, geofence.latitude, geofence.longitude);
      return distance <= geofence.radius;
    });
    if (geofenceSettings.allowCheckInOutside) {
      geofenceStatus = isWithinGeofence ? 'inside' : 'outside';
      // Allow check-in regardless of location
    } else {
      if (!isWithinGeofence) {
        const geofenceNames = geofences.map(g => g.name).filter(Boolean).join(', ');
        return res.status(403).json({
          message: geofenceNames
            ? `You must be at ${geofenceNames} to check in.`
            : 'You are not within an authorized check-in location.'
        });
      }
      geofenceStatus = 'inside';
    }
  }

  // Find the latest attendance record for today
  const existingAttendance = await Attendance.findOne({
    user: req.user._id,
    checkIn: {
      $gte: today,
      $lt: tomorrow
    }
  }).sort({ checkIn: -1 });

  // Allow new check-in if no record exists or last record is checked out
  if (!existingAttendance || existingAttendance.checkOut) {
    const attendance = await Attendance.create({
      user: req.user._id,
      organization: req.user.organization._id,
      date: today,
      checkIn: new Date(),
      location: { latitude, longitude },
      geofenceStatus
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

// Helper function to convert IP to long integer
function ipToLong(ip) {
  return ip.split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
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

  const formattedStaff = Array.from(latestRecords.values()).map(record => {
    let profileImageUrl = record.user.profileImage;
    
    // Convert S3 key to signed URL if it's a profile image
    if (profileImageUrl && profileImageUrl.startsWith('profile-images/')) {
      try {
        profileImageUrl = getSignedUrl(profileImageUrl, 3600); // 1 hour expiration
      } catch (error) {
        console.warn('Could not generate signed URL for profile image:', error.message);
        profileImageUrl = null;
      }
    }

    return {
      id: record.user._id,
      name: record.user.fullName,
      email: record.user.email,
      department: record.user.department,
      profileImage: profileImageUrl,
      checkInTime: record.checkIn,
      checkOutTime: record.checkOut,
      status: record.checkOut ? 'Checked Out' : 'Present',
      geofenceStatus: record.geofenceStatus || null
    };
  });

  res.json(formattedStaff);
});

// Get all staff attendance status for today (admin only)
const getAllStaffAttendanceStatus = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all active staff in the organization
  const User = require('../models/User');
  const allStaff = await User.find({
    organization: req.user.organization._id,
    status: { $ne: 'archived' }
  }).select('_id fullName email department role profileImage');

  // Get today's attendance records
  const todayAttendance = await Attendance.find({
    organization: req.user.organization._id,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  }).populate('user', '_id');

  // Create a map of user ID to attendance record
  const attendanceMap = new Map();
  todayAttendance.forEach(record => {
    const userId = record.user._id.toString();
    if (!attendanceMap.has(userId) || record.checkIn > attendanceMap.get(userId).checkIn) {
      attendanceMap.set(userId, record);
    }
  });

  // Format response with attendance status for each staff member
  const staffWithStatus = allStaff.map(staff => {
    const attendance = attendanceMap.get(staff._id.toString());
    let status = 'Not Checked In';
    let checkInTime = null;
    let checkOutTime = null;

    if (attendance) {
      if (attendance.checkOut) {
        status = 'Checked Out';
        checkInTime = attendance.checkIn;
        checkOutTime = attendance.checkOut;
      } else {
        status = 'Present';
        checkInTime = attendance.checkIn;
      }
    }

    let profileImageUrl = staff.profileImage;
    
    // Convert S3 key to signed URL if it's a profile image
    if (profileImageUrl && profileImageUrl.startsWith('profile-images/')) {
      try {
        profileImageUrl = getSignedUrl(profileImageUrl, 3600); // 1 hour expiration
      } catch (error) {
        console.warn('Could not generate signed URL for profile image:', error.message);
        profileImageUrl = null;
      }
    }

    return {
      id: staff._id,
      fullName: staff.fullName,
      email: staff.email,
      department: staff.department,
      role: staff.role,
      profileImage: profileImageUrl,
      status,
      checkInTime,
      checkOutTime
    };
  });

  res.json(staffWithStatus);
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

  const formattedStaff = absentStaff.map(user => {
    let profileImageUrl = user.profileImage;
    
    // Convert S3 key to signed URL if it's a profile image
    if (profileImageUrl && profileImageUrl.startsWith('profile-images/')) {
      try {
        profileImageUrl = getSignedUrl(profileImageUrl, 3600); // 1 hour expiration
      } catch (error) {
        console.warn('Could not generate signed URL for profile image:', error.message);
        profileImageUrl = null;
      }
    }
    
    return {
      id: user._id,
      name: user.fullName,
      email: user.email,
      department: user.department,
      profileImage: profileImageUrl,
      status: 'Absent'
    };
  });

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

    let profileImageUrl = user.profileImage;
    
    // Convert S3 key to signed URL if it's a profile image
    if (profileImageUrl && profileImageUrl.startsWith('profile-images/')) {
      try {
        profileImageUrl = getSignedUrl(profileImageUrl, 3600); // 1 hour expiration
      } catch (error) {
        console.warn('Could not generate signed URL for profile image:', error.message);
        profileImageUrl = null;
      }
    }

    return {
      id: user._id,
      name: user.fullName,
      email: user.email,
      department: user.department,
      profileImage: profileImageUrl,
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
  console.log('sendAbsenceEmails called with:', { userIds, date, reason });
  
  if (!Array.isArray(userIds) || userIds.length === 0) {
    console.log('No users selected for absence notification');
    return res.status(400).json({ message: 'No users selected.' });
  }
  
  // Fetch user info
  const users = await User.find({ _id: { $in: userIds } }).select('fullName email');
  if (!users.length) {
    console.log('No users found for the provided IDs');
    return res.status(404).json({ message: 'No users found.' });
  }
  
  console.log(`Found ${users.length} users to send absence notifications to`);
  
  // Prepare user data for email utility
  const userList = users.map(u => ({ email: u.email, name: u.fullName }));
  console.log('User list prepared:', userList);
  
  try {
    console.log('Calling sendAbsenceNotificationEmail...');
    const results = await sendAbsenceNotificationEmail(userList, date, reason);
    console.log('Email sending results:', results);
    
    // Generate notifications for selected staff
    await notificationService.notifyUsers({
      userIds,
      organization: req.user.organization._id || req.user.organization,
      message: `You have received an absence notification for ${date || 'today'}.`,
      type: 'attendance',
      link: '/attendance-history',
      sender: req.user._id
    });
    
    console.log('Absence notification process completed successfully');
    res.json({ success: true, ...results });
  } catch (err) {
    console.error('Error in sendAbsenceEmails:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send emails', 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
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
  sendAbsenceEmails,
  getAllStaffAttendanceStatus
}; 