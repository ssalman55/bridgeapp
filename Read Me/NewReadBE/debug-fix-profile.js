const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');

async function debugAndFixProfile() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
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
    console.log(`   National ID:`, JSON.stringify(user.nationalId, null, 2));

    // Find their staff profile
    let staffProfile = await StaffProfile.findOne({
      staffId: user._id,
      organization: user.organization
    });

    console.log(`\n📋 Staff Profile Status:`);
    if (!staffProfile) {
      console.log('   ❌ No StaffProfile found - creating one...');
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
      console.log('   ✅ StaffProfile found');
      console.log(`   Current completion: ${staffProfile.completionPercentage || 0}%`);
      console.log(`   Current isComplete: ${staffProfile.isComplete}`);
      console.log(`   Personal Info:`, JSON.stringify(staffProfile.personalInfo, null, 2));
      
      // Update National ID if missing
      if (!staffProfile.personalInfo) {
        staffProfile.personalInfo = {};
      }
      
      if (user.nationalId && !staffProfile.personalInfo.nationalId) {
        console.log('   🔄 Syncing National ID from User to StaffProfile...');
        staffProfile.personalInfo.nationalId = user.nationalId;
      }
    }

    // Recalculate completion percentage
    console.log('\n🧮 Recalculating completion...');
    const { percentage, isComplete } = calculateCompletion(staffProfile);
    console.log(`   Calculated completion: ${percentage}%`);
    console.log(`   Calculated isComplete: ${isComplete}`);
    
    staffProfile.completionPercentage = percentage;
    staffProfile.isComplete = isComplete;

    await staffProfile.save();
    console.log(`\n✅ Profile saved successfully!`);

    // Verify the fix
    const updatedProfile = await StaffProfile.findOne({
      staffId: user._id,
      organization: user.organization
    });
    
    console.log(`\n🔍 Final Verification:`);
    console.log(`   Completion: ${updatedProfile.completionPercentage}%`);
    console.log(`   Is Complete: ${updatedProfile.isComplete}`);
    console.log(`   National ID Present: ${!!updatedProfile.personalInfo?.nationalId}`);
    
    if (updatedProfile.personalInfo?.nationalId) {
      console.log(`   National ID Data:`, JSON.stringify(updatedProfile.personalInfo.nationalId, null, 2));
    }

    console.log(`\n🎉 Fix Complete! Please refresh both pages to see the changes.`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Helper function to calculate profile completion
function calculateCompletion(profile) {
  console.log('   📊 Calculating completion for profile...');
  
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

  console.log(`   📈 Fields filled: ${filledFields}/${totalFields}`);
  console.log(`   📈 National ID check: ${!!(profile.personalInfo?.nationalId?.qid || profile.personalInfo?.nationalId?.emiratesId || profile.personalInfo?.nationalId?.iqama || profile.personalInfo?.nationalId?.civilId || profile.personalInfo?.nationalId?.cpr || profile.personalInfo?.nationalId?.nationalId)}`);

  return {
    percentage,
    isComplete: percentage === 100,
  };
}

// Run fix if called directly
if (require.main === module) {
  debugAndFixProfile();
}

module.exports = debugAndFixProfile;








