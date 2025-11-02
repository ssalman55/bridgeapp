const axios = require('axios');

const testSuspensionAPI = async () => {
  try {
    console.log('🧪 Testing suspension API response...');
    
    // Test with a suspended organization user
    const loginData = {
      email: 'ssalman55@hotmail.com',
      password: 'password123' // Try a more common password
    };
    
    console.log('📤 Sending login request for suspended organization user...');
    
    // Use the actual Render backend URL
    const backendUrl = process.env.BACKEND_URL || 'https://sbfront-7xef.onrender.com';
    const response = await axios.post(`${backendUrl}/api/auth/login`, loginData, {
      timeout: 10000,
      validateStatus: () => true // Don't throw on non-2xx status
    });
    
    console.log('📥 Response received:');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 403) {
      console.log('✅ SUCCESS: Backend correctly returned 403 for suspended organization');
      console.log('Error code:', response.data.code);
      console.log('Error message:', response.data.message);
      
      if (response.data.code === 'ORGANIZATION_SUSPENDED') {
        console.log('✅ SUCCESS: Correct error code ORGANIZATION_SUSPENDED');
      } else {
        console.log('❌ ERROR: Wrong error code, expected ORGANIZATION_SUSPENDED');
      }
      
      if (response.data.message && response.data.message.includes('paused')) {
        console.log('✅ SUCCESS: Error message contains suspension information');
      } else {
        console.log('❌ ERROR: Error message missing suspension details');
      }
    } else {
      console.log('❌ ERROR: Expected 403 status, got:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

// Check if server is running
const checkServer = async () => {
  try {
    // Try to connect to the Render server
    const backendUrl = process.env.BACKEND_URL || 'https://sbfront-7xef.onrender.com';
    const response = await axios.get(backendUrl, { timeout: 10000 });
    console.log('✅ Render server is accessible');
    return true;
  } catch (error) {
    console.log('❌ Render server is not accessible:', error.message);
    return false;
  }
};

const runTest = async () => {
  console.log('🚀 Starting suspension API test...');
  const serverRunning = await checkServer();
  if (serverRunning) {
    await testSuspensionAPI();
  } else {
    console.log('❌ Cannot proceed without server running');
  }
  console.log('🏁 Test completed');
  process.exit(0);
};

runTest();
