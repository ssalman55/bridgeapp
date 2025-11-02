#!/usr/bin/env node

/**
 * Script to upload the StaffBridge logo to Amazon S3
 * 
 * Prerequisites:
 * 1. AWS credentials must be configured in the .env file:
 *    - AWS_ACCESS_KEY_ID
 *    - AWS_SECRET_ACCESS_KEY
 *    - AWS_REGION
 *    - AWS_S3_BUCKET
 * 
 * 2. The logo file must exist at: frontend/public/images/SBNewLogo.png
 * 
 * Usage:
 * node scripts/upload-logo-to-s3.js
 */

const fs = require('fs');
const path = require('path');
const { uploadFile, getFileUrl } = require('../src/utils/s3');

async function uploadLogoToS3() {
  try {
    console.log('🚀 Starting StaffBridge logo upload to S3...');
    
    // Check if the logo file exists
    const logoPath = path.join(__dirname, '../../frontend/public/images/SBNewLogo.png');
    console.log('📁 Looking for logo at:', logoPath);
    
    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo file not found at:', logoPath);
      console.log('Please ensure the logo file is placed at frontend/public/images/SBNewLogo.png');
      process.exit(1);
    }
    
    console.log('✅ Logo file found!');
    
    // Check AWS environment variables
    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required AWS environment variables:');
      missingVars.forEach(varName => console.error(`   - ${varName}`));
      console.log('\nPlease add these variables to your .env file and try again.');
      process.exit(1);
    }
    
    console.log('✅ AWS environment variables configured');
    
    // Read the logo file
    const logoBuffer = fs.readFileSync(logoPath);
    console.log(`📊 Logo file size: ${(logoBuffer.length / 1024).toFixed(2)} KB`);
    
    // Create a mock file object for the upload function
    const mockFile = {
      buffer: logoBuffer,
      mimetype: 'image/png',
      originalname: 'staffbridge-logo.png'
    };

    // Upload to S3 with a specific key
    const s3Key = 'logos/staffbridge-logo.png';
    console.log('☁️  Uploading logo to S3...');
    console.log(`   Bucket: ${process.env.AWS_S3_BUCKET}`);
    console.log(`   Key: ${s3Key}`);
    
    const result = await uploadFile(mockFile, s3Key);
    console.log('✅ Logo uploaded successfully!');
    console.log('📍 S3 Location:', result.Location);
    
    // Get the public URL
    const publicUrl = getFileUrl(s3Key);
    console.log('🌐 Public URL:', publicUrl);
    
    // Update the frontend config file
    const configPath = path.join(__dirname, '../../frontend/src/config/logoConfig.js');
    const configDir = path.dirname(configPath);
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const configContent = `// Auto-generated logo configuration
// Last updated: ${new Date().toISOString()}

// S3 URL for the StaffBridge logo
export const LOGO_URL = '${publicUrl}';
export const LOGO_S3_KEY = '${s3Key}';

// Logo metadata
export const LOGO_ALT_TEXT = 'StaffBridge Logo';
export const LOGO_SIZES = {
  sm: 32,
  md: 48,
  lg: 72,
};
`;
    
    fs.writeFileSync(configPath, configContent);
    console.log('📝 Logo configuration updated at:', configPath);
    
    console.log('\n🎉 Logo upload completed successfully!');
    console.log('The logo is now available at:', publicUrl);
    console.log('\nNext steps:');
    console.log('1. The frontend will automatically use the new S3 URL');
    console.log('2. Restart your frontend development server if needed');
    console.log('3. The logo should now be served from S3 instead of local files');
    
  } catch (error) {
    console.error('❌ Error uploading logo:', error.message);
    
    if (error.code === 'CredentialsError') {
      console.log('\n💡 AWS Credentials Error:');
      console.log('   Please check your AWS credentials in the .env file');
      console.log('   Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct');
    } else if (error.code === 'NoSuchBucket') {
      console.log('\n💡 S3 Bucket Error:');
      console.log('   The specified S3 bucket does not exist or you do not have access to it');
      console.log('   Please check AWS_S3_BUCKET in your .env file');
    } else if (error.code === 'AccessDenied') {
      console.log('\n💡 Access Denied Error:');
      console.log('   You do not have permission to upload to this S3 bucket');
      console.log('   Please check your AWS permissions');
    }
    
    process.exit(1);
  }
}

// Run the upload
uploadLogoToS3();


































