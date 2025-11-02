const axios = require('axios');

async function testSubscriptionAPI() {
  try {
    // Test the API endpoint directly
    const response = await axios.get('http://localhost:5000/api/organization/subscription-status/65f8b8b8b8b8b8b8b8b8b8b8', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testSubscriptionAPI(); 