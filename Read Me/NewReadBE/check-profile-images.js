const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = require('./src/models/User');

async function checkProfileImages() {
  try {
    console.log('🔍 Checking Profile Image Status...\n');

    // Find all users
    const users = await User.find({}).select('email profileImage');

    console.log(`📊 Found ${users.length} total users\n`);

    let s3KeyCount = 0;
    let fullUrlCount = 0;
    let localPathCount = 0;
    let noImageCount = 0;

    for (const user of users) {
      if (!user.profileImage) {
        noImageCount++;
        continue;
      }

      if (user.profileImage.includes('amazonaws.com')) {
        fullUrlCount++;
        console.log(`🔗 ${user.email}: Full S3 URL (needs migration)`);
      } else if (user.profileImage.startsWith('/uploads/')) {
        localPathCount++;
        console.log(`📁 ${user.email}: Local file path`);
      } else if (!user.profileImage.includes('http') && !user.profileImage.startsWith('/')) {
        s3KeyCount++;
        console.log(`🔑 ${user.email}: S3 Key (${user.profileImage})`);
      } else {
        console.log(`❓ ${user.email}: Unknown format (${user.profileImage})`);
      }
    }

    console.log('\n📋 Summary:');
    console.log(`   🔑 S3 Keys (ready for signed URLs): ${s3KeyCount}`);
    console.log(`   🔗 Full S3 URLs (need migration): ${fullUrlCount}`);
    console.log(`   📁 Local file paths: ${localPathCount}`);
    console.log(`   ❌ No profile image: ${noImageCount}`);
    console.log(`   📊 Total users: ${users.length}`);

    if (fullUrlCount > 0) {
      console.log('\n💡 Recommendation: Run the migration script to convert full URLs to S3 keys');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run check if called directly
if (require.main === module) {
  checkProfileImages();
}

module.exports = { checkProfileImages }; 
 
 
 
 