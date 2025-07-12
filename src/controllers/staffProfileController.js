const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const mongoose = require('mongoose');

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
      // If profile doesn't exist, create one
      const newProfile = new StaffProfile({
        staffId: req.user._id,
        organization: req.user.organization,
        isComplete: false
      });
      await newProfile.save();
      console.log('Created new profile:', newProfile._id);
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

    let profile = await StaffProfile.findOne({ 
      staffId: req.user._id, 
      organization: req.user.organization 
    });

    if (!profile) {
      profile = new StaffProfile({ 
        staffId: req.user._id, 
        organization: req.user.organization 
      });
      console.log('Creating new profile');
    }

    // Only allow staff to update their own profile
    Object.assign(profile, req.body);
    profile.organization = req.user.organization;
    
    // Calculate completion
    const { percentage, isComplete } = calculateCompletion(profile);
    profile.completionPercentage = percentage;
    profile.isComplete = isComplete;
    
    await profile.save();
    console.log('Profile updated successfully:', profile._id);
    
    res.json(profile);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get all staff profiles (paginated, searchable)
exports.getAllProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = { organization: req.user.organization };
    
    if (search) {
      query.$or = [
        { 'personalInfo.nationality': { $regex: search, $options: 'i' } },
        { 'personalInfo.gender': { $regex: search, $options: 'i' } },
        { 'personalInfo.maritalStatus': { $regex: search, $options: 'i' } },
      ];
    }

    const profiles = await StaffProfile.find(query)
      .populate('staffId', 'fullName email department role profileImage')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await StaffProfile.countDocuments(query);

    // Fetch all staff users in this organization
    const allStaff = await User.find({ 
      role: 'staff', 
      organization: req.user.organization, 
      status: { $ne: 'archived' } 
    }, 'fullName email department role profileImage');

    res.json({ 
      profiles, 
      allStaff, 
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