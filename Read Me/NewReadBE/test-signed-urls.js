const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = require('./src/models/User');
const { getSignedUrl } = require('./src/utils/s3');

async function testSignedUrls() {
  try {
    console.log('🧪 Testing Signed URL Generation...\n');

    // Find a user with a profile image
    const user = await User.findOne({
      profileImage: { $exists: true, $ne: null }
    });

    if (!user) {
      console.log('❌ No users found with profile images');
      return;
    }

    console.log(`👤 Testing with user: ${user.email}`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Current profileImage (S3 key): ${user.profileImage}`);
    console.log(`   Is S3 key (not full URL): ${!user.profileImage.includes('http')}`);

    if (user.profileImage.includes('http')) {
      console.log('   ⚠️  Warning: profileImage still contains full URL, not S3 key');
      console.log('   💡 Run the migration script first');
      return;
    }

    // Generate signed URL
    console.log('\n🔑 Generating signed URL...');
    const signedUrl = getSignedUrl(user.profileImage, 3600); // 1 hour
    
    console.log(`   ✅ Signed URL generated successfully!`);
    console.log(`   📏 URL length: ${signedUrl.length} characters`);
    console.log(`   🔗 URL starts with: ${signedUrl.substring(0, 50)}...`);
    console.log(`   ⏰ Expires in: 1 hour`);
    
    // Check if it's a valid signed URL
    if (signedUrl.includes('?') && signedUrl.includes('X-Amz-Signature')) {
      console.log('   ✅ URL contains required signed URL parameters');
    } else {
      console.log('   ❌ URL missing signed URL parameters');
    }

    // Test URL accessibility
    console.log('\n🌐 Testing signed URL accessibility...');
    try {
      const axios = require('axios');
      const response = await axios.get(signedUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        validateStatus: (status) => true
      });

      console.log(`   📊 Response Status: ${response.status}`);
      console.log(`   📊 Content-Type: ${response.headers['content-type']}`);
      console.log(`   📊 Content-Length: ${response.headers['content-length']}`);

      if (response.status === 200) {
        console.log('   ✅ SUCCESS: Signed URL is accessible!');
        console.log('   🎯 Profile images should now work in the frontend');
      } else {
        console.log(`   ❌ FAILED: Status ${response.status}`);
      }

    } catch (error) {
      console.log(`   ❌ Error testing URL: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run test if called directly
if (require.main === module) {
  testSignedUrls();
}

module.exports = { testSignedUrls }; 
 
 
 