const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables the same way as your main app
dotenv.config();

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');

async function checkUserProfile() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    // Use the same MongoDB URI as your main app
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('MONGODB_URI found:', process.env.MONGODB_URI ? 'Yes' : 'No');
    
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
    const staffProfile = await StaffProfile.findOne({
      staffId: user._id,
      organization: user.organization
    });

    if (!staffProfile) {
      console.log('❌ Staff Profile not found');
      return;
    }

    console.log(`\n📋 Staff Profile Found:`);
    console.log(`   Completion: ${staffProfile.completionPercentage || 0}%`);
    console.log(`   Is Complete: ${staffProfile.isComplete}`);
    console.log(`   Personal Info:`, staffProfile.personalInfo);
    console.log(`   National ID in Profile:`, staffProfile.personalInfo?.nationalId);

    // Check if National ID is missing
    if (!staffProfile.personalInfo?.nationalId) {
      console.log('\n🔧 Fixing National ID in Staff Profile...');
      
      if (!staffProfile.personalInfo) {
        staffProfile.personalInfo = {};
      }
      staffProfile.personalInfo.nationalId = user.nationalId;
      
      // Recalculate completion
      const { percentage, isComplete } = calculateCompletion(staffProfile);
      staffProfile.completionPercentage = percentage;
      staffProfile.isComplete = isComplete;
      
      await staffProfile.save();
      console.log(`✅ Updated completion to: ${percentage}%`);
    } else {
      console.log('✅ National ID already exists in Staff Profile');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Helper function to calculate profile completion (copied from controller)
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

// Run check if called directly
if (require.main === module) {
  checkUserProfile();
}

module.exports = checkUserProfile;








