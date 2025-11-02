const User = require('../models/User');
const Attendance = require('../models/Attendance');
const bcrypt = require('bcryptjs');
const csv = require('csv-parse');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Organization = require('../models/Organization');
const LeaveRequest = require('../models/LeaveRequest');
const StaffProfile = require('../models/StaffProfile');
const { getSignedUrl } = require('../utils/s3');

// Helper: Get staff limit info for an organization
async function getStaffLimitInfo(orgId) {
  const org = await Organization.findById(orgId);
  if (!org) return { plan: 'unknown', staffLimit: 0, unlimited: false };
  let planName = org.plan.charAt(0).toUpperCase() + org.plan.slice(1);
  let staffLimit;
  let unlimited = false;
  if (org.plan === 'basic') {
    staffLimit = 10;
  } else if (org.plan === 'professional') {
    staffLimit = 100;
  } else if (org.plan === 'enterprise') {
    staffLimit = Number.MAX_SAFE_INTEGER;
    unlimited = true;
  } else {
    // fallback for custom/unknown plans
    staffLimit = org.staffLimit || 10;
  }
  return { plan: org.plan, planName, staffLimit, unlimited };
}

// Get staff statistics (admin only, organization-specific)
exports.getStaffStats = async (req, res) => {
  try {
    const totalStaff = await User.countDocuments({ 
      organization: req.user.organization,
      status: { $ne: 'archived' }
    });

    // Calculate present staff for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Find unique staff IDs who have checked in today (from same organization)
    const presentUserIds = await Attendance.distinct('user', {
      date: { $gte: today, $lt: tomorrow },
      organization: req.user.organization
    });
    const presentToday = presentUserIds.length;

    // Absent = total staff - present staff
    const absentToday = totalStaff - presentToday;

    // On leave (from same organization)
    const onLeaveUserIds = await LeaveRequest.distinct('user', {
      organization: req.user.organization,
      status: { $in: ['approved', 'Approved'] },
      startDate: { $lte: today },
      endDate: { $gte: today }
    });
    const onLeave = onLeaveUserIds.length;

    // For staff users, calculate their specific stats
    if (req.user.role === 'staff') {
      // Calculate total presents (count 1 for check in for a day, unique checkIn dates)
      const presentsAgg = await Attendance.aggregate([
        {
          $match: {
            user: req.user._id,
            organization: req.user.organization,
            checkIn: { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$checkIn' },
              month: { $month: '$checkIn' },
              day: { $dayOfMonth: '$checkIn' }
            }
          }
        },
        {
          $count: 'uniqueDays'
        }
      ]);
      const totalPresents = presentsAgg.length > 0 ? presentsAgg[0].uniqueDays : 0;

      // Calculate total absents (count when staff never checked in on a day)
      const totalAbsents = await Attendance.countDocuments({
        user: req.user._id,
        organization: req.user.organization,
        status: 'absent'
      });

      // Calculate late check-ins (count when staff checked in after 7AM, unique checkIn dates)
      const lateAgg = await Attendance.aggregate([
        {
          $match: {
            user: req.user._id,
            organization: req.user.organization,
            checkIn: { $exists: true }
          }
        },
        {
          $addFields: {
            checkInHour: { $hour: '$checkIn' }
          }
        },
        {
          $match: {
            checkInHour: { $gt: 7 }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$checkIn' },
              month: { $month: '$checkIn' },
              day: { $dayOfMonth: '$checkIn' }
            }
          }
        },
        {
          $count: 'lateDays'
        }
      ]);
      const lateCheckIns = lateAgg.length > 0 ? lateAgg[0].lateDays : 0;

      // Calculate total approved leaves
      const totalLeaves = await User.countDocuments({
        _id: req.user._id,
        organization: req.user.organization,
        'leave.status': 'Approved'
      });

      return res.json({
        totalPresents,
        totalAbsents,
        lateCheckIns,
        totalLeaves
      });
    }

    // Get department statistics with error handling (organization-specific)
    let departments = [];
    try {
      departments = await User.aggregate([
        { 
          $match: { 
            organization: req.user.organization,
            status: { $ne: 'archived' }
          }
        },
        { 
          $group: { 
            _id: '$department', 
            count: { $sum: 1 } 
          }
        },
        { 
          $project: { 
            name: '$_id', 
            count: 1, 
            _id: 0 
          }
        }
      ]);
    } catch (aggregateError) {
      console.error('Error aggregating departments:', aggregateError);
    }

    res.json({
      totalStaff,
      presentToday,
      absentToday,
      onLeave,
      departments: departments || []
    });
  } catch (error) {
    console.error('Error getting staff stats:', error);
    res.status(500).json({ 
      message: 'Error getting staff statistics',
      departments: []
    });
  }
};

// Create new staff member (admin only, inherits admin's organization)
exports.createStaff = async (req, res) => {
  try {
    const { fullName, email, password, phone, department, role } = req.body;

    // Debug log to check user and organization
    console.log('Creating staff with admin user:', {
      adminId: req.user._id,
      adminRole: req.user.role,
      organization: req.user.organization
    });

    if (!req.user.organization) {
      console.error('Admin user has no organization:', req.user);
      return res.status(400).json({ message: 'Admin user has no organization assigned' });
    }

    // Check if user already exists in the same organization
    const existingUser = await User.findOne({ 
      email,
      organization: req.user.organization
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists in your organization' });
    }

    // Enforce staff limit
    const { plan, planName, staffLimit, unlimited } = await getStaffLimitInfo(req.user.organization);
    if (!unlimited) {
      const userCount = await User.countDocuments({
        organization: req.user.organization,
        status: { $ne: 'archived' }
      });
      if (userCount >= staffLimit) {
        return res.status(403).json({
          message: `Your subscription type is ${planName}, which supports up to ${staffLimit} staff accounts. To add more staff members, please upgrade to the Professional or Enterprise plan.`,
          billingLink: '/billing',
          support: 'For any questions, contact us at support@staffbridge.com.'
        });
      }
    }

    // Create new user - password will be hashed by pre-save middleware
    const newUser = new User({
      fullName,
      email,
      password, // Plain password - will be hashed by pre-save middleware
      phone,
      department,
      organization: req.user.organization,
      role: role || 'staff'
    });

    const savedUser = await newUser.save();

    // Create staff profile
    const staffProfile = new StaffProfile({
      staffId: savedUser._id,
      organization: req.user.organization,
      isComplete: false
    });
    await staffProfile.save();

    console.log('Staff member and profile created successfully:', {
      userId: savedUser._id,
      profileId: staffProfile._id
    });

    res.status(201).json({
      message: 'Staff member created successfully',
      staff: {
        id: savedUser._id,
        fullName: savedUser.fullName,
        email: savedUser.email,
        phone: savedUser.phone,
        department: savedUser.department,
        role: savedUser.role,
        organization: savedUser.organization
      }
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    // Send more detailed error message
    res.status(500).json({ 
      message: 'Error creating staff member',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : null
    });
  }
};

// Get all staff members (admin only, organization-specific)
exports.getAllStaff = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === '1';
    const query = {
      organization: req.user.organization
    };
    if (!includeArchived) {
      query.status = { $ne: 'archived' };
    }
    const staff = await User.find(query)
      .select('-password')
      .sort({ fullName: 1 });

    // Convert S3 keys to signed URLs for profile images
    const staffWithSignedUrls = staff.map(member => {
      const memberObj = member.toObject();
      if (memberObj.profileImage && memberObj.profileImage.startsWith('profile-images/')) {
        try {
          memberObj.profileImage = getSignedUrl(memberObj.profileImage, 3600); // 1 hour expiration
        } catch (error) {
          console.warn('Could not generate signed URL for profile image:', error.message);
          memberObj.profileImage = null;
        }
      }
      return memberObj;
    });

    res.json(staffWithSignedUrls);
  } catch (error) {
    console.error('Error getting staff:', error);
    res.status(500).json({ message: 'Error retrieving staff members' });
  }
};

// Update staff member (admin only, organization-specific)
exports.updateStaff = async (req, res) => {
  try {
    const { fullName, email, department } = req.body;
    const staffId = req.params.id;

    const staff = await User.findOne({ 
      _id: staffId,
      organization: req.user.organization
    });

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found in your organization' });
    }

    // Update fields
    staff.fullName = fullName || staff.fullName;
    staff.email = email || staff.email;
    staff.department = department || staff.department;
    staff.phone = req.body.phone || staff.phone;
    if (req.body.role) staff.role = req.body.role;

    await staff.save();

    res.json({
      message: 'Staff member updated successfully',
      staff: {
        id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        department: staff.department,
        role: staff.role
      }
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ message: 'Error updating staff member' });
  }
};

// Delete staff member (admin only, organization-specific)
exports.deleteStaff = async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await User.findOne({ 
      _id: staffId,
      organization: req.user.organization
    });
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found in your organization' });
    }

    await User.findByIdAndDelete(staffId);
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ message: 'Error deleting staff member' });
  }
};

// Import staff from CSV
exports.importStaffFromCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    console.log('Starting CSV import process...');
    
    // Convert the CSV parsing to a Promise-based approach
    const parseCSV = (buffer) => {
      return new Promise((resolve, reject) => {
    const records = [];
    const parser = csv.parse({
      columns: true,
          skip_empty_lines: true,
          trim: true // Add trim to handle whitespace
    });

    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });

        parser.on('end', function() {
          console.log(`CSV parsing completed. Found ${records.length} records.`);
          resolve(records);
        });

        parser.on('error', function(err) {
          console.error('CSV parsing error:', err);
          reject(err);
        });

        parser.write(buffer.toString());
        parser.end();
      });
    };

    // Parse the CSV file
    const records = await parseCSV(req.file.buffer);
    console.log('CSV records parsed successfully:', records.length);

        const results = {
          success: [],
          errors: []
        };

        // Process each record
    for (const [index, record] of records.entries()) {
          try {
        console.log(`Processing record ${index + 1}/${records.length}:`, record.email);

            // Validate required fields
        if (!record.fullName || !record.email || !record.department) {
          console.log(`Record ${index + 1} validation failed: Missing required fields`);
              results.errors.push({
            row: index + 1,
                email: record.email || 'No email provided',
            error: 'Missing required fields (fullName, email, department are required)'
              });
              continue;
            }

            // Check if user already exists
            const existingUser = await User.findOne({
          email: record.email.toLowerCase().trim(),
              organization: req.user.organization
            });

            if (existingUser) {
          console.log(`Record ${index + 1} skipped: User already exists - ${record.email}`);
              results.errors.push({
            row: index + 1,
                email: record.email,
            error: 'User already exists in this organization'
              });
              continue;
            }

        // Use a fixed default password for all imported users
        const defaultPassword = 'Default123!';
        // Do NOT hash here; let the User model pre-save middleware hash it

            // Create new user
            const newUser = new User({
          fullName: record.fullName.trim(),
          email: record.email.toLowerCase().trim(),
          password: defaultPassword, // Pass plaintext, let pre-save hash
          phone: record.phone ? record.phone.trim() : '',
          department: record.department.trim(),
          role: (record.role || 'staff').toLowerCase() === 'admin' ? 'staff' : (record.role || 'staff').toLowerCase(),
              status: record.status || 'active',
              organization: req.user.organization
            });

        const savedUser = await newUser.save();
        console.log(`Record ${index + 1} processed successfully:`, savedUser.email);

            results.success.push({
          row: index + 1,
              email: record.email,
          tempPassword: defaultPassword // This should be sent via email in production
            });
          } catch (error) {
        console.error(`Error processing record ${index + 1}:`, error);
            results.errors.push({
          row: index + 1,
              email: record.email || 'Unknown',
              error: error.message
            });
          }
        }

    console.log('Import process completed:', {
      total: records.length,
      successful: results.success.length,
      failed: results.errors.length
    });

    // Enforce staff limit for bulk import
    const { plan, planName, staffLimit, unlimited } = await getStaffLimitInfo(req.user.organization);
    if (!unlimited) {
      const userCount = await User.countDocuments({
        organization: req.user.organization,
        status: { $ne: 'archived' }
      });
      const newStaffCount = records.length;
      if (userCount + newStaffCount > staffLimit) {
        return res.status(403).json({
          message: `Your subscription type is ${planName}, which supports up to ${staffLimit} staff accounts. To add more staff members, please upgrade to the Professional or Enterprise plan.`,
          billingLink: '/billing',
          support: 'For any questions, contact us at support@staffbridge.com.'
        });
      }
    }

    // Send response with detailed results
        res.json({
      success: results.success.length > 0,
      message: results.success.length > 0 ? 'Staff imported successfully' : 'No staff were imported',
          summary: {
            total: records.length,
            successful: results.success.length,
            failed: results.errors.length
          },
      results: {
        success: results.success,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('Error in staff import process:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error importing staff',
      error: error.message
    });
  }
};

exports.getActivePeers = async (req, res) => {
  try {
    const staff = await User.find({
      _id: { $ne: req.user._id },
      status: 'active',
      organization: req.user.organization
    }).select('_id fullName email');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch peers', error: err.message });
  }
};

// Admin: Send password reset link to user
exports.adminSendPasswordResetLink = async (req, res) => {
  try {
    // Only admin can trigger
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(expires);
    await user.save();

    // Build reset link using the correct base URL
    const baseUrl = (process.env.LIVE_FRONTEND_URL || process.env.FRONTEND_URL || 'https://www.stfbridge.com').replace(/\/$/, '');
    const resetLink = `${baseUrl}/reset-password/${token}`;

    // Use the centralized email service instead of creating a new transporter
    const { sendForgotPasswordEmail } = require('../services/emailService');
    await sendForgotPasswordEmail({
      to: user.email,
      fullName: user.fullName,
      resetLink
    });

    // Audit log
    console.log(`[AUDIT] Admin ${req.user.email} requested password reset for user ${user.email} at ${new Date().toISOString()}`);

    res.json({ success: true, message: 'Password reset link sent successfully to user.' });
  } catch (error) {
    console.error('Error sending password reset link:', error);
    res.status(500).json({ success: false, message: 'Failed to send password reset link', error: error.message });
  }
};

// Bulk delete staff members (admin only, organization-specific)
exports.bulkDeleteStaff = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No staff IDs provided' });
    }

    // Verify all staff members belong to the organization
    const staffToDelete = await User.find({
      _id: { $in: ids },
      organization: req.user.organization,
      status: { $ne: 'archived' }
    });

    if (staffToDelete.length === 0) {
      return res.status(404).json({ message: 'No staff members found in your organization' });
    }

    // Delete the staff members
    const result = await User.deleteMany({
      _id: { $in: ids },
      organization: req.user.organization
    });

    res.json({ 
      message: `${result.deletedCount} staff members deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting staff:', error);
    res.status(500).json({ message: 'Error deleting staff members' });
  }
};

// Archive a staff member (admin only)
exports.archiveStaff = async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await User.findOne({
      _id: staffId,
      organization: req.user.organization
    });
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found in your organization' });
    }
    staff.status = 'archived';
    staff.archivedAt = new Date();
    await staff.save();
    res.json({ message: 'Staff member archived successfully' });
  } catch (error) {
    console.error('Error archiving staff:', error);
    res.status(500).json({ message: 'Error archiving staff member' });
  }
};

// Unarchive a staff member (admin only)
exports.unarchiveStaff = async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await User.findOne({
      _id: staffId,
      organization: req.user.organization
    });
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found in your organization' });
    }
    staff.status = 'active';
    staff.archivedAt = null;
    await staff.save();
    res.json({ message: 'Staff member unarchived successfully' });
  } catch (error) {
    console.error('Error unarchiving staff:', error);
    res.status(500).json({ message: 'Error unarchiving staff member' });
  }
};

exports.getUpcomingBirthdays = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const user = req.user;
    const organization = user.organization;
    
    console.log(`🎂 getUpcomingBirthdays called by user: ${user.email}, org: ${organization}`);
    
    // Calculate date range - normalize dates to start/end of day for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + parseInt(days));
    endDate.setHours(23, 59, 59, 999); // End of day
    
    console.log(`📅 Looking for birthdays between ${today.toISOString()} and ${endDate.toISOString()}`);
    
    // Find all active staff members with birthdays
    const currentYear = today.getFullYear();
    
    // Query staff profiles with non-null dob and populate user data
    const staffProfiles = await StaffProfile.find({
      organization: organization,
      'personalInfo.dob': { $exists: true, $ne: null }
    }).populate({
      path: 'staffId',
      model: 'User',
      match: { status: 'active' },
      select: 'fullName profileImage department status'
    });
    
    console.log(`👥 Found ${staffProfiles.length} staff profiles with populated user data`);
    
    // Filter to only include users that are active and transform to match expected structure
    const staff = staffProfiles.filter(profile => 
      profile.staffId && profile.staffId.status === 'active'
    ).map(profile => ({
      _id: profile.staffId._id,
      fullName: profile.staffId.fullName,
      profileImage: profile.staffId.profileImage,
      department: profile.staffId.department,
      position: profile.staffId.department, // Using department as position fallback
      dob: profile.personalInfo.dob
    }));
    
    console.log(`✅ Converted to ${staff.length} staff members with birthdays`);
    
    // Process birthdays for current year
    const upcomingBirthdays = [];
    
    staff.forEach(person => {
      try {
        let birthday;
        
        // Handle different date formats from the database
        if (typeof person.dob === 'string') {
          // Handle ISO strings like "2025-10-05T00:00:00.000Z"
          birthday = new Date(person.dob);
        } else if (person.dob instanceof Date) {
          birthday = person.dob;
        } else {
          console.log(`Skipping ${person.fullName}: invalid DOB format`, person.dob);
          return;
        }
        
        // Validate the date
        if (isNaN(birthday.getTime())) {
          console.log(`Skipping ${person.fullName}: invalid date`);
          return;
        }
        
        console.log(`Processing ${person.fullName}: original DOB ${birthday.toISOString()}`);
        
        // Extract month and day from the original birthday (ignore the year)
        const birthMonth = birthday.getMonth();
        const birthDay = birthday.getDate();
        
        // Create this year's birthday date
        const thisYearBirthday = new Date(currentYear, birthMonth, birthDay);
        console.log(`${person.fullName}: this year birthday ${thisYearBirthday.toISOString()}`);
        
        // Check if this year's birthday falls within our range
        if (thisYearBirthday >= today && thisYearBirthday <= endDate) {
          console.log(`✅ Adding ${person.fullName} - birthday is in current year range`);
          upcomingBirthdays.push({
            _id: person._id,
            fullName: person.fullName,
            profileImage: person.profileImage ? getSignedUrl(`profiles/${person.profileImage}`) : null,
            department: person.department,
            position: person.position,
            dob: person.dob,
            birthdayThisYear: thisYearBirthday.toISOString()
          });
        } else if (thisYearBirthday < today) {
          // Birthday already passed this year, check next year's birthday
          const nextYearBirthday = new Date(currentYear + 1, birthMonth, birthDay);
          console.log(`${person.fullName}: next year birthday ${nextYearBirthday.toISOString()}`);
          
          if (nextYearBirthday <= endDate) {
            console.log(`✅ Adding ${person.fullName} - birthday is in next year`);
            upcomingBirthdays.push({
              _id: person._id,
              fullName: person.fullName,
              profileImage: person.profileImage ? getSignedUrl(`profiles/${person.profileImage}`) : null,
              department: person.department,
              position: person.position,
              dob: person.dob,
              birthdayThisYear: nextYearBirthday.toISOString()
            });
          }
        } else {
          console.log(`❌ Skipping ${person.fullName} - birthday ${thisYearBirthday.toISOString()} is outside range`);
        }
      } catch (error) {
        console.error('Error processing birthday for', person.fullName, ':', error);
      }
    });
    
    console.log(`🎉 Final result: ${upcomingBirthdays.length} upcoming birthdays`);
    
    if (upcomingBirthdays.length > 0) {
      console.log('🎊 Birthdays found:', upcomingBirthdays.map(b => ({
        name: b.fullName,
        birthdayThisYear: b.birthdayThisYear
      })));
    } else {
      console.log('😔 No upcoming birthdays found');
    }
    
    // Sort by birthday date (today's birthdays first)
    upcomingBirthdays.sort((a, b) => {
      const dateA = new Date(a.birthdayThisYear);
      const dateB = new Date(b.birthdayThisYear);
      
      // If one is today and the other isn't, prioritize today
      const aIsToday = dateA.toDateString() === new Date().toDateString();
      const bIsToday = dateB.toDateString() === new Date().toDateString();
      
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      
      // Otherwise sort by date
      return dateA - dateB;
    });
    
    console.log(`📤 Sending response with ${upcomingBirthdays.length} birthdays`);
    res.json(upcomingBirthdays);
    
  } catch (error) {
    console.error('Error fetching upcoming birthdays:', error);
    res.status(500).json({ message: 'Error fetching upcoming birthdays' });
  }
}; 