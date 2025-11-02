const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { uploadFile, getProfileImageUrl, deleteFile } = require('../src/utils/s3');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Get User model
const User = require('../src/models/User');

// Function to check if file exists locally
const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

// Function to read file as buffer
const readFileAsBuffer = (filePath) => {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
};

// Function to migrate a single profile image
const migrateProfileImage = async (user) => {
  try {
    if (!user.profileImage || user.profileImage.includes('amazonaws.com')) {
      console.log(`User ${user.email} already has S3 image or no image`);
      return { success: true, skipped: true };
    }

    // Extract filename from profileImage path
    const filename = user.profileImage.split('/').pop();
    const localFilePath = path.join(__dirname, '../uploads', filename);

    if (!fileExists(localFilePath)) {
      console.log(`Local file not found for user ${user.email}: ${localFilePath}`);
      return { success: false, error: 'Local file not found' };
    }

    // Read file as buffer
    const fileBuffer = readFileAsBuffer(localFilePath);
    if (!fileBuffer) {
      return { success: false, error: 'Could not read file' };
    }

    // Create file object for S3 upload
    const file = {
      buffer: fileBuffer,
      mimetype: 'image/jpeg', // Default to JPEG, you might want to detect this
      originalname: filename
    };

    // Generate S3 key
    const timestamp = Date.now();
    const fileExtension = filename.split('.').pop();
    const s3Key = `profile-images/${user.organization}/${user._id}-${timestamp}.${fileExtension}`;

    console.log(`Uploading ${user.email} profile image to S3: ${s3Key}`);

    // Upload to S3
    const s3Result = await uploadFile(file, s3Key);
    const s3Url = getProfileImageUrl(s3Key);

    // Update user with S3 URL
    user.profileImage = s3Url;
    await user.save();

    console.log(`Successfully migrated profile image for ${user.email} to S3`);

    // Optionally delete local file (uncomment if you want to remove local files)
    // fs.unlinkSync(localFilePath);
    // console.log(`Deleted local file: ${localFilePath}`);

    return { success: true, s3Url, s3Key };
  } catch (error) {
    console.error(`Error migrating profile image for user ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Main migration function
const migrateAllProfileImages = async () => {
  try {
    console.log('Starting profile image migration to S3...');

    // Get all users with profile images
    const users = await User.find({ 
      profileImage: { $exists: true, $ne: null, $ne: '' },
      profileImage: { $not: /amazonaws\.com/ } // Only local images
    });

    console.log(`Found ${users.length} users with local profile images`);

    if (users.length === 0) {
      console.log('No local profile images found to migrate');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const result = await migrateProfileImage(user);
      
      if (result.success) {
        if (result.skipped) {
          skippedCount++;
        } else {
          successCount++;
        }
      } else {
        errorCount++;
        console.error(`Failed to migrate ${user.email}:`, result.error);
      }
    }

    console.log('\nMigration Summary:');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already S3): ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total processed: ${users.length}`);

  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await migrateAllProfileImages();
    console.log('Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Check if script is run directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateAllProfileImages }; 
 
 