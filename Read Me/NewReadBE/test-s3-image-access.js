const axios = require('axios');
require('dotenv').config();

// Test S3 image accessibility
async function testS3ImageAccess() {
  try {
    console.log('🧪 Testing S3 Image Accessibility...\n');

    // Test URL from your debug component
    const testImageUrl = 'https://staffbridgeuploads.s3.eu-north-1.amazonaws.com/profile-images/68985608d1946094f97b0748/68985608d1946094f97b074a-1755115512843.jpg';
    
    console.log('📸 Testing image URL:', testImageUrl);
    console.log('⏳ Attempting to fetch image...\n');

    const response = await axios.get(testImageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      validateStatus: (status) => true // Don't throw on any status
    });

    console.log('📊 Response Details:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Content-Length: ${response.headers['content-length']}`);
    console.log(`   Data Size: ${response.data ? response.data.length : 0} bytes`);

    if (response.status === 200) {
      console.log('\n✅ SUCCESS: Image is accessible from S3!');
      console.log('   The issue might be with CORS or browser security policies.');
      
      // Check if it's actually an image
      if (response.headers['content-type'] && response.headers['content-type'].startsWith('image/')) {
        console.log('   ✅ Content-Type confirms this is an image file');
      } else {
        console.log('   ⚠️  Warning: Content-Type is not an image type');
      }
      
    } else if (response.status === 403) {
      console.log('\n❌ ACCESS DENIED (403): S3 bucket policy issue');
      console.log('   💡 Solution: Update S3 bucket policy to allow public read access');
      
    } else if (response.status === 404) {
      console.log('\n❌ NOT FOUND (404): Image file does not exist at this path');
      console.log('   💡 Solution: Check if the S3 key path is correct');
      
    } else {
      console.log('\n❌ UNEXPECTED STATUS:', response.status);
      console.log('   💡 Check S3 bucket configuration and permissions');
    }

    // Test with different user agent to simulate browser
    console.log('\n🌐 Testing with browser-like user agent...');
    try {
      const browserResponse = await axios.get(testImageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        responseType: 'arraybuffer',
        timeout: 10000,
        validateStatus: (status) => true
      });
      
      console.log(`   Browser Test Status: ${browserResponse.status}`);
      if (browserResponse.status === 200) {
        console.log('   ✅ Browser simulation successful');
      } else {
        console.log('   ❌ Browser simulation failed');
      }
    } catch (browserError) {
      console.log('   ❌ Browser simulation error:', browserError.message);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('   💡 Network/DNS issue - check internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   💡 Connection refused - check S3 bucket name and region');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('   💡 Request timeout - check network connectivity');
    }
  }
}

// Run the test
if (require.main === module) {
  testS3ImageAccess();
}

module.exports = { testS3ImageAccess }; 
 
 