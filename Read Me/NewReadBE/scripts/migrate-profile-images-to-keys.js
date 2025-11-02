const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = require('../src/models/User');

async function migrateProfileImagesToKeys() {
  try {
    console.log('🔄 Starting profile image migration to S3 keys...\n');

    // Find all users with profile images that contain full S3 URLs
    const usersWithFullUrls = await User.find({
      profileImage: { 
        $exists: true, 
        $ne: null,
        $regex: /amazonaws\.com/
      }
    });

    console.log(`📊 Found ${usersWithFullUrls.length} users with full S3 URLs`);

    if (usersWithFullUrls.length === 0) {
      console.log('✅ No users need migration. All profile images are already using S3 keys.');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of usersWithFullUrls) {
      try {
        console.log(`\n👤 Processing user: ${user.email} (${user._id})`);
        console.log(`   Current profileImage: ${user.profileImage}`);

        // Extract S3 key from the full URL
        const s3Key = user.profileImage.split('amazonaws.com/')[1];
        
        if (!s3Key) {
          console.log(`   ⚠️  Could not extract S3 key from URL: ${user.profileImage}`);
          errorCount++;
          continue;
        }

        console.log(`   Extracted S3 key: ${s3Key}`);

        // Update user with S3 key instead of full URL
        user.profileImage = s3Key;
        await user.save();

        console.log(`   ✅ Successfully migrated to S3 key`);
        migratedCount++;

      } catch (error) {
        console.error(`   ❌ Error migrating user ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📋 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} users`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    console.log(`   📊 Total processed: ${usersWithFullUrls.length} users`);

    if (migratedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   Profile images are now stored as S3 keys and will generate signed URLs on-demand.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateProfileImagesToKeys();
}

module.exports = { migrateProfileImagesToKeys }; 
 
 