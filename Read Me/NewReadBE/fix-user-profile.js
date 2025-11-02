const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');

async function fixUserProfile() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the specific user
    const user = await User.findOne({ email: 'sahmad@acsdoha.school' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`\n👤 User Found: ${user.fullName} (${user.email})`);
    console.log(`   Organization: ${user.organization}`);
    console.log(`   National ID:`, user.nationalId);

    // Find their staff profile
    let staffProfile = await StaffProfile.findOne({
      staffId: user._id,
      organization: user.organization
    });

    if (!staffProfile) {
      console.log('📝 Creating new StaffProfile...');
      staffProfile = new StaffProfile({
        staffId: user._id,
        organization: user.organization,
        personalInfo: {
          dob: null,
          gender: null,
          nationality: null,
          maritalStatus: null,
          emergencyContact: {},
          nationalId: user.nationalId || {}
        },
        isComplete: false,
        completionPercentage: 0
      });
    } else {
      console.log('🔄 Updating existing StaffProfile...');
      
      if (!staffProfile.personalInfo) {
        staffProfile.personalInfo = {};
      }
      
      // Sync National ID from User to StaffProfile
      if (user.nationalId && !staffProfile.personalInfo.nationalId) {
        staffProfile.personalInfo.nationalId = user.nationalId;
        console.log('   🔄 Synced National ID');
      }
    }

    // Recalculate completion percentage
    const { percentage, isComplete } = calculateCompletion(staffProfile);
    staffProfile.completionPercentage = percentage;
    staffProfile.isComplete = isComplete;

    await staffProfile.save();
    console.log(`✅ Profile saved with completion: ${percentage}% (${isComplete ? 'Complete' : 'Incomplete'})`);

    // Verify the fix
    const updatedProfile = await StaffProfile.findOne({
      staffId: user._id,
      organization: user.organization
    });
    
    console.log(`\n🔍 Verification:`);
    console.log(`   Completion: ${updatedProfile.completionPercentage}%`);
    console.log(`   Is Complete: ${updatedProfile.isComplete}`);
    console.log(`   National ID:`, updatedProfile.personalInfo?.nationalId);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Helper function to calculate profile completion
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

// Run fix if called directly
if (require.main === module) {
  fixUserProfile();
}

module.exports = fixUserProfile;








