#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { uploadFile, getFileUrl } = require('./src/utils/s3');

async function uploadLogo() {
  try {
    console.log('Starting logo upload process...');
    
    // Check if the logo file exists in the public/images directory
    const logoPath = path.join(__dirname, '../frontend/public/images/SBNewLogo.png');
    console.log('Looking for logo at:', logoPath);
    
    if (!fs.existsSync(logoPath)) {
      console.error('Logo file not found at:', logoPath);
      console.log('Please ensure the logo file is placed at frontend/public/images/SBNewLogo.png');
      process.exit(1);
    }
    
    console.log('Logo file found!');

    // Read the logo file
    const logoBuffer = fs.readFileSync(logoPath);
    
    // Create a mock file object for the upload function
    const mockFile = {
      buffer: logoBuffer,
      mimetype: 'image/png',
      originalname: 'staffbridge-logo.png'
    };

    // Upload to S3 with a specific key
    const s3Key = 'logos/staffbridge-logo.png';
    console.log('Uploading logo to S3...');
    
    const result = await uploadFile(mockFile, s3Key);
    console.log('Logo uploaded successfully!');
    console.log('S3 Location:', result.Location);
    
    // Get the public URL
    const publicUrl = getFileUrl(s3Key);
    console.log('Public URL:', publicUrl);
    
    // Save the URL to a config file for the frontend to use
    const configPath = path.join(__dirname, '../frontend/src/config/logoConfig.js');
    const configDir = path.dirname(configPath);
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const configContent = `// Auto-generated logo configuration
export const LOGO_URL = '${publicUrl}';
export const LOGO_S3_KEY = '${s3Key}';
`;
    
    fs.writeFileSync(configPath, configContent);
    console.log('Logo configuration saved to:', configPath);
    
    console.log('\n✅ Logo upload completed successfully!');
    console.log('The logo is now available at:', publicUrl);
    
  } catch (error) {
    console.error('Error uploading logo:', error);
    process.exit(1);
  }
}

// Run the upload
uploadLogo();
