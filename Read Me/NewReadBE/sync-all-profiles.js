const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');
const Organization = require('./src/models/Organization');

async function syncAllUserProfiles() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({ 
      status: { $ne: 'archived' } 
    });

    console.log(`\n👥 Found ${users.length} users to sync`);

    let syncedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (const user of users) {
      console.log(`\n👤 Processing: ${user.fullName} (${user.email})`);
      
      // Find or create staff profile
      let staffProfile = await StaffProfile.findOne({
        staffId: user._id,
        organization: user.organization
      });

      if (!staffProfile) {
        // Create new staff profile
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
        createdCount++;
        console.log('   📝 Created new StaffProfile');
      } else {
        // Update existing staff profile
        if (!staffProfile.personalInfo) {
          staffProfile.personalInfo = {};
        }
        
        // Sync National ID from User to StaffProfile
        if (user.nationalId && !staffProfile.personalInfo.nationalId) {
          staffProfile.personalInfo.nationalId = user.nationalId;
          console.log('   🔄 Synced National ID');
        }
        
        updatedCount++;
        console.log('   🔄 Updated existing StaffProfile');
      }

      // Recalculate completion percentage
      const { percentage, isComplete } = calculateCompletion(staffProfile);
      staffProfile.completionPercentage = percentage;
      staffProfile.isComplete = isComplete;

      await staffProfile.save();
      console.log(`   ✅ Completion: ${percentage}% (${isComplete ? 'Complete' : 'Incomplete'})`);
      
      syncedCount++;
    }

    console.log(`\n🎉 Sync Complete!`);
    console.log(`   📊 Total processed: ${syncedCount}`);
    console.log(`   📝 Created: ${createdCount}`);
    console.log(`   🔄 Updated: ${updatedCount}`);

  } catch (error) {
    console.error('❌ Sync failed:', error);
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

// Run sync if called directly
if (require.main === module) {
  syncAllUserProfiles();
}

module.exports = syncAllUserProfiles;
