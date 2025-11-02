const { uploadFile, getProfileImageUrl, deleteFile } = require('./src/utils/s3');
require('dotenv').config();

// Test S3 configuration and profile image upload
async function testS3ProfileUpload() {
  try {
    console.log('🧪 Testing S3 Profile Image Upload Configuration...\n');

    // Check environment variables
    console.log('📋 Environment Variables Check:');
    console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`AWS_REGION: ${process.env.AWS_REGION ? `✅ ${process.env.AWS_REGION}` : '❌ Missing'}`);
    console.log(`AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET ? `✅ ${process.env.AWS_S3_BUCKET}` : '❌ Missing'}\n`);

    // Check if all required variables are set
    const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('❌ Missing required environment variables:', missingVars.join(', '));
      console.log('Please set these variables in your .env file or environment.');
      return;
    }

    console.log('✅ All required environment variables are set!\n');

    // Test S3 connection by creating a test file
    console.log('🔗 Testing S3 Connection...');
    
    // Create a simple test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0x00, 0x00,
      0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    // Create test file object
    const testFile = {
      buffer: testImageBuffer,
      mimetype: 'image/png',
      originalname: 'test-profile-image.png'
    };

    // Generate test S3 key
    const testKey = `test/profile-images/test-${Date.now()}.png`;
    
    console.log(`📤 Uploading test file to S3: ${testKey}`);

    // Upload test file
    const uploadResult = await uploadFile(testFile, testKey);
    console.log('✅ Test file uploaded successfully!');
    console.log(`   S3 Location: ${uploadResult.Location}`);
    console.log(`   S3 Key: ${uploadResult.Key}`);

    // Test getting the URL
    const fileUrl = getProfileImageUrl(testKey);
    console.log(`🔗 Generated URL: ${fileUrl}`);

    // Test deletion
    console.log('🗑️  Cleaning up test file...');
    await deleteFile(testKey);
    console.log('✅ Test file deleted successfully!');

    console.log('\n🎉 S3 Profile Image Upload Test PASSED!');
    console.log('Your S3 configuration is working correctly.');
    console.log('Profile images can now be uploaded to S3.');

  } catch (error) {
    console.error('\n❌ S3 Profile Image Upload Test FAILED!');
    console.error('Error:', error.message);
    
    if (error.code === 'CredentialsError') {
      console.error('\n💡 Troubleshooting Tips:');
      console.error('1. Check your AWS credentials are correct');
      console.error('2. Verify your AWS user has S3 permissions');
      console.error('3. Ensure your AWS region is correct');
    } else if (error.code === 'NoSuchBucket') {
      console.error('\n💡 Troubleshooting Tips:');
      console.error('1. Check your S3 bucket name is correct');
      console.error('2. Verify the bucket exists in the specified region');
      console.error('3. Ensure your AWS user has access to the bucket');
    } else if (error.code === 'AccessDenied') {
      console.error('\n💡 Troubleshooting Tips:');
      console.error('1. Check your AWS user has S3 upload permissions');
      console.error('2. Verify bucket policy allows uploads');
      console.error('3. Check if bucket has public access blocked');
    }
    
    console.error('\n📚 For more help, check the README_PROFILE_IMAGES_S3.md file');
  }
}

// Run the test
if (require.main === module) {
  testS3ProfileUpload();
}

module.exports = { testS3ProfileUpload }; 
 
 