const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Try multiple locations for .env file
const envPaths = [
  path.join(__dirname, '.env'),           // backend/.env
  path.join(__dirname, '..', '.env'),     // root/.env
  path.join(process.cwd(), '.env'),       // current working directory
  path.join(process.cwd(), 'backend', '.env') // current/backend/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && result.parsed.MONGO_URI) {
      console.log(`✅ Loaded environment from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

// Check if MONGO_URI is available from environment variables (not just .env file)
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI or MONGO_URI not found in environment variables');
  console.log('Tried the following paths:');
  envPaths.forEach(p => console.log(`   - ${p}`));
  console.log('\nPlease ensure you have a .env file with MONGODB_URI defined');
  console.log('Or set MONGODB_URI as an environment variable');
  console.log('\nExample .env file content:');
  console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.log('\nOr set environment variable:');
  console.log('set MONGODB_URI=your_mongodb_atlas_uri');
  process.exit(1);
}

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');

async function migrateNationalIdToStaffProfiles() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    console.log('🔄 Starting National ID migration...');

    // Find all users with National ID data
    const usersWithNationalId = await User.find({
      $or: [
        { 'nationalId.qid': { $exists: true, $ne: null, $ne: '' } },
        { 'nationalId.emiratesId': { $exists: true, $ne: null, $ne: '' } },
        { 'nationalId.iqama': { $exists: true, $ne: null, $ne: '' } },
        { 'nationalId.civilId': { $exists: true, $ne: null, $ne: '' } },
        { 'nationalId.cpr': { $exists: true, $ne: null, $ne: '' } },
        { 'nationalId.nationalId': { $exists: true, $ne: null, $ne: '' } }
      ]
    });

    console.log(`📊 Found ${usersWithNationalId.length} users with National ID data`);

    let migratedCount = 0;
    let createdCount = 0;

    for (const user of usersWithNationalId) {
      try {
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
              nationalId: user.nationalId
            },
            isComplete: false,
            completionPercentage: 0
          });
          createdCount++;
        } else {
          // Update existing staff profile
          if (!staffProfile.personalInfo) {
            staffProfile.personalInfo = {};
          }
          staffProfile.personalInfo.nationalId = user.nationalId;
          migratedCount++;
        }

        // Recalculate completion percentage
        const { percentage, isComplete } = calculateCompletion(staffProfile);
        staffProfile.completionPercentage = percentage;
        staffProfile.isComplete = isComplete;

        await staffProfile.save();

        console.log(`✅ Migrated National ID for user: ${user.fullName} (${user.email})`);

      } catch (error) {
        console.error(`❌ Error migrating user ${user.fullName}:`, error.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   - Total users processed: ${usersWithNationalId.length}`);
    console.log(`   - New profiles created: ${createdCount}`);
    console.log(`   - Existing profiles updated: ${migratedCount}`);
    console.log('✅ National ID migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
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

// Run migration if called directly
if (require.main === module) {
  migrateNationalIdToStaffProfiles();
}

module.exports = migrateNationalIdToStaffProfiles;
