const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');

async function testAPIResponse() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Simulate the getAllProfiles API call
    const organizationId = '68a7709feb5ba8ce200dfe0b'; // Your organization ID
    
    console.log('\n🔍 Testing getAllProfiles API response...');
    
    // Get profiles (like the API does)
    const profiles = await StaffProfile.find({ organization: organizationId })
      .populate('staffId', 'fullName email department role profileImage')
      .sort({ createdAt: -1 });

    console.log(`\n📋 Found ${profiles.length} StaffProfile records:`);
    profiles.forEach((profile, index) => {
      console.log(`\n   Profile ${index + 1}:`);
      console.log(`   - Profile ID: ${profile._id}`);
      console.log(`   - Staff ID: ${profile.staffId?._id}`);
      console.log(`   - Staff Name: ${profile.staffId?.fullName}`);
      console.log(`   - Staff Email: ${profile.staffId?.email}`);
      console.log(`   - Completion: ${profile.completionPercentage}%`);
      console.log(`   - Is Complete: ${profile.isComplete}`);
    });

    // Get all staff (like the API does)
    const allStaff = await User.find({ 
      organization: organizationId, 
      status: { $ne: 'archived' } 
    }, 'fullName email department role profileImage');

    console.log(`\n👥 Found ${allStaff.length} User records:`);
    allStaff.forEach((staff, index) => {
      console.log(`\n   User ${index + 1}:`);
      console.log(`   - User ID: ${staff._id}`);
      console.log(`   - Name: ${staff.fullName}`);
      console.log(`   - Email: ${staff.email}`);
    });

    // Test the frontend merging logic
    console.log(`\n🔄 Testing frontend merging logic...`);
    const profilesWithStaff = allStaff.map((staff) => {
      const profile = profiles.find((p) => p.staffId?._id.toString() === staff._id.toString());
      console.log(`   Staff ${staff.fullName}: ${profile ? 'FOUND profile' : 'NO profile found'}`);
      if (profile) {
        console.log(`     - Profile completion: ${profile.completionPercentage}%`);
        console.log(`     - Profile isComplete: ${profile.isComplete}`);
      }
      return profile ? { ...profile, staffId: staff } : { 
        staffId: staff, 
        isComplete: false, 
        completionPercentage: 0 
      };
    });

    console.log(`\n✅ Merging complete. Final results:`);
    profilesWithStaff.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.staffId.fullName}: ${item.completionPercentage}% (${item.isComplete ? 'Complete' : 'Incomplete'})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run test if called directly
if (require.main === module) {
  testAPIResponse();
}

module.exports = testAPIResponse;








