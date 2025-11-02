const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');

async function testExactAPIResponse() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Simulate the exact getAllProfiles API call
    const organizationId = '68a7709feb5ba8ce200dfe0b'; // Your organization ID
    const page = 1;
    const limit = 20;
    const search = '';
    
    console.log('\n🔍 Testing exact getAllProfiles API response...');
    
    // Get profiles (exactly like the API does)
    const query = { organization: organizationId };
    const profiles = await StaffProfile.find(query)
      .populate('staffId', 'fullName email department role profileImage')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Get all staff (exactly like the API does)
    const allStaff = await User.find({ 
      organization: organizationId, 
      status: { $ne: 'archived' } 
    }, 'fullName email department role profileImage');

    // Find Salman Ahmad specifically
    const salmanUser = allStaff.find(staff => staff.email === 'sahmad@acsdoha.school');
    const salmanProfile = profiles.find(p => p.staffId?._id.toString() === salmanUser?._id.toString());

    console.log(`\n👤 Salman Ahmad Analysis:`);
    console.log(`   User ID: ${salmanUser?._id}`);
    console.log(`   Profile ID: ${salmanProfile?._id}`);
    console.log(`   Profile Completion: ${salmanProfile?.completionPercentage}%`);
    console.log(`   Profile IsComplete: ${salmanProfile?.isComplete}`);
    console.log(`   Profile PersonalInfo:`, JSON.stringify(salmanProfile?.personalInfo, null, 2));

    // Test the exact frontend merging logic
    console.log(`\n🔄 Testing exact frontend merging logic...`);
    const profilesWithStaff = allStaff.map((staff) => {
      const profile = profiles.find((p) => p.staffId?._id.toString() === staff._id.toString());
      if (profile) {
        // This is the EXACT logic from the frontend
        return { 
          ...profile, 
          staffId: staff,
          // Ensure completionPercentage is preserved
          completionPercentage: profile.completionPercentage || 0,
          isComplete: profile.isComplete || false
        };
      } else {
        return { 
          staffId: staff, 
          isComplete: false, 
          completionPercentage: 0,
          personalInfo: {},
          workExperience: [],
          education: [],
          medicalHistory: {},
          additionalInfo: {}
        };
      }
    });

    // Find Salman in the merged results
    const salmanMerged = profilesWithStaff.find(item => item.staffId?.email === 'sahmad@acsdoha.school');
    
    console.log(`\n✅ Merged Result for Salman Ahmad:`);
    console.log(`   Completion: ${salmanMerged?.completionPercentage}%`);
    console.log(`   IsComplete: ${salmanMerged?.isComplete}`);
    console.log(`   PersonalInfo:`, JSON.stringify(salmanMerged?.personalInfo, null, 2));

    // Test the API response structure
    const apiResponse = { 
      profiles, 
      allStaff, 
      total: profiles.length, 
      page: Number(page), 
      pages: Math.ceil(profiles.length / limit) 
    };

    console.log(`\n📊 API Response Summary:`);
    console.log(`   Total profiles: ${apiResponse.profiles.length}`);
    console.log(`   Total staff: ${apiResponse.allStaff.length}`);
    console.log(`   Salman profile found: ${!!salmanProfile}`);
    console.log(`   Salman profile completion: ${salmanProfile?.completionPercentage}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run test if called directly
if (require.main === module) {
  testExactAPIResponse();
}

module.exports = testExactAPIResponse;








