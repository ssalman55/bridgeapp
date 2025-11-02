const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendProfileCompletionEmail } = require('../services/emailService');
const Organization = require('../models/Organization');
const { getSignedUrl } = require('../utils/s3');

// Staff: Get their own profile
exports.getMyProfile = async (req, res) => {
  try {
    console.log('Getting profile for user:', {
      userId: req.user._id,
      organizationId: req.user.organization
    });

    const profile = await StaffProfile.findOne({ 
      staffId: req.user._id, 
      organization: req.user.organization 
    }).populate('staffId', 'fullName email department role profileImage');

    if (!profile) {
      // If profile doesn't exist, create one with User data
      const newProfile = new StaffProfile({
        staffId: req.user._id,
        organization: req.user.organization,
        personalInfo: {
          dob: null,
          gender: null,
          nationality: null,
          maritalStatus: null,
          emergencyContact: {},
          nationalId: req.user.nationalId || {}
        },
        isComplete: false,
        completionPercentage: 0
      });
      
      // Calculate initial completion
      const { percentage, isComplete } = calculateCompletion(newProfile);
      newProfile.completionPercentage = percentage;
      newProfile.isComplete = isComplete;
      
      await newProfile.save();
      console.log('Created new profile:', newProfile._id, 'with completion:', percentage + '%');
      return res.json(newProfile);
    }

    console.log('Found existing profile:', profile._id);
    res.json(profile);
  } catch (err) {
    console.error('Error getting profile:', err);
    res.status(500).json({ message: err.message });
  }
};

// Staff: Create or update their own profile
exports.updateMyProfile = async (req, res) => {
  try {
    console.log('Updating profile for user:', {
      userId: req.user._id,
      organizationId: req.user.organization,
      body: req.body
    });

    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }

    let profile = await StaffProfile.findOne({ 
      staffId: req.user._id, 
      organization: organizationId 
    });

    if (!profile) {
      profile = new StaffProfile({ 
        staffId: req.user._id, 
        organization: organizationId 
      });
      console.log('Creating new profile');
    }

    // Store the previous completion status
    const wasComplete = profile.isComplete;

    // Only allow staff to update their own profile
    Object.assign(profile, req.body);
    profile.organization = organizationId;
    
    // Calculate completion
    const { percentage, isComplete } = calculateCompletion(profile);
    profile.completionPercentage = percentage;
    profile.isComplete = isComplete;
    
    await profile.save();
    console.log('Profile updated successfully:', profile._id);
    
    // Check if profile was just completed to 100%
    if (!wasComplete && isComplete) {
      console.log('Profile completed to 100% - sending notification emails');
      
      // Get organization details for email
      let organization;
      if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
        // Organization is already populated
        organization = req.user.organization;
      } else {
        // Organization is not populated, fetch it
        organization = await Organization.findById(organizationId);
      }
      
      if (!organization) {
        console.error('Organization not found for profile completion:', organizationId);
      } else {
        // Notify all admins in the SAME organization only - ensure tenant isolation
        const admins = await User.find({ 
          organization: organizationId, 
          role: 'admin', 
          status: { $ne: 'archived' } 
        });
        
        console.log(`Found ${admins.length} admins in organization ${organization.name} (${organizationId})`);
        
        // Send SMTP emails to all admins in the same organization only
        if (admins.length > 0) {
          try {
            console.log(`Sending profile completion emails to ${admins.length} admins in organization: ${organization.name} (${organizationId})`);
            
            const emailResult = await sendProfileCompletionEmail({
              organization,
              admins,
              staff: {
                fullName: req.user.fullName,
                email: req.user.email,
                department: req.user.department,
                role: req.user.role
              },
              profile
            });
            
            console.log('Profile completion emails sent successfully:', {
              organization: organization.name,
              organizationId: organizationId,
              totalSent: emailResult.totalSent,
              totalFailed: emailResult.totalFailed,
              successfulEmails: emailResult.successfulEmails,
              failedEmails: emailResult.failedEmails
            });
          } catch (emailError) {
            console.error('Failed to send profile completion emails:', emailError);
            // Don't fail the request if email sending fails
          }
        } else {
          console.log('No admins found in organization:', {
            organizationName: organization.name,
            organizationId: organizationId
          });
        }
      }
    }
    
    res.json(profile);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get all staff profiles (paginated, searchable)
exports.getAllProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', organizationId } = req.query;
    
    // Use organizationId parameter if provided, otherwise use the user's organization
    const queryOrganization = organizationId || req.user.organization;
    const query = { organization: queryOrganization };
    
    if (search) {
      query.$or = [
        { 'personalInfo.nationality': { $regex: search, $options: 'i' } },
        { 'personalInfo.gender': { $regex: search, $options: 'i' } },
        { 'personalInfo.maritalStatus': { $regex: search, $options: 'i' } },
      ];
    }

    // If searching, get all profiles to ensure we find the user
    // Otherwise use pagination
    let profiles;
    let total;
    
    if (search) {
      // For search, get all profiles to ensure we find the user
      profiles = await StaffProfile.find(query)
        .populate('staffId', 'fullName email department role profileImage')
        .sort({ createdAt: -1 });
      total = profiles.length;
    } else {
      // For regular browsing, use pagination
      profiles = await StaffProfile.find(query)
        .populate('staffId', 'fullName email department role profileImage')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ createdAt: -1 });
      total = await StaffProfile.countDocuments(query);
    }

    // Fetch all staff users in this organization (regardless of role)
    const allStaff = await User.find({ 
      organization: queryOrganization, 
      status: { $ne: 'archived' } 
    }, 'fullName email department role profileImage organization');

    // Convert S3 keys to signed URLs for profile images in allStaff
    const allStaffWithSignedUrls = allStaff.map(member => {
      const memberObj = member.toObject();
      if (memberObj.profileImage && memberObj.profileImage.startsWith('profile-images/')) {
        try {
          memberObj.profileImage = getSignedUrl(memberObj.profileImage, 3600); // 1 hour expiration
        } catch (error) {
          console.warn('Failed to generate signed URL for profile image:', error.message);
          memberObj.profileImage = null; // Remove invalid S3 key
        }
      }
      return memberObj;
    });

    // Convert S3 keys to signed URLs for profile images in populated profiles
    const profilesWithSignedUrls = profiles.map(profile => {
      const profileObj = profile.toObject();
      if (profileObj.staffId && profileObj.staffId.profileImage && profileObj.staffId.profileImage.startsWith('profile-images/')) {
        try {
          profileObj.staffId.profileImage = getSignedUrl(profileObj.staffId.profileImage, 3600); // 1 hour expiration
        } catch (error) {
          console.warn('Failed to generate signed URL for profile image:', error.message);
          profileObj.staffId.profileImage = null; // Remove invalid S3 key
        }
      }
      return profileObj;
    });

    res.json({ 
      profiles: profilesWithSignedUrls, 
      allStaff: allStaffWithSignedUrls, 
      total, 
      page: Number(page), 
      pages: Math.ceil(total / limit) 
    });
  } catch (err) {
    console.error('Error getting all profiles:', err);
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get a specific staff profile by profileId
exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid profile ID' });
    }

    const profile = await StaffProfile.findOne({ 
      _id: id, 
      organization: req.user.organization 
    }).populate('staffId', 'fullName email department role profileImage');

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json(profile);
  } catch (err) {
    console.error('Error getting profile by ID:', err);
    res.status(500).json({ message: err.message });
  }
};

// Admin: Export all profiles (CSV/Excel placeholder)
exports.exportProfiles = async (req, res) => {
  // Placeholder: implement CSV/Excel export logic
  res.status(501).json({ message: 'Export not implemented yet' });
};

// Helper: Calculate profile completion percentage
function calculateCompletion(profile) {
  const fields = [
    // Personal Info
    profile.personalInfo?.dob,
    profile.personalInfo?.gender,
    profile.personalInfo?.nationality,
    profile.personalInfo?.maritalStatus,
    profile.personalInfo?.emergencyContact?.name,
    profile.personalInfo?.emergencyContact?.phone,
    profile.personalInfo?.emergencyContact?.relationship,
    // National ID (at least one required for WPS compliance)
    profile.personalInfo?.nationalId?.qid ||
    profile.personalInfo?.nationalId?.emiratesId ||
    profile.personalInfo?.nationalId?.iqama ||
    profile.personalInfo?.nationalId?.civilId ||
    profile.personalInfo?.nationalId?.cpr ||
    profile.personalInfo?.nationalId?.nationalId,
    // Work Experience (at least one)
    profile.workExperience?.length > 0,
    // Education (at least one)
    profile.education?.length > 0,
    // Medical
    profile.medicalHistory?.preExistingConditions,
    profile.medicalHistory?.allergies,
    // Additional Info
    profile.additionalInfo?.bankAccount,
  ];

  const filledFields = fields.filter(Boolean).length;
  const totalFields = fields.length;
  const percentage = Math.round((filledFields / totalFields) * 100);

  return {
    percentage,
    isComplete: percentage === 100,
  };
} 