const axios = require('axios');

async function testPlanSelection() {
  try {
    console.log('Testing plan selection for organization creation...');
    
    const testData = {
      fullName: 'Test User',
      email: 'test-plan@example.com',
      password: 'TestPass123!',
      organizationName: 'Test Plan Org',
      plan: 'enterprise'
    };
    
    console.log('Sending registration data:', testData);
    
    const response = await axios.post('http://localhost:5000/auth/register', testData);
    
    console.log('Registration successful!');
    console.log('Response:', response.data);
    
    // Check if the organization was created with the correct plan
    if (response.data.organization) {
      console.log('Organization created with plan:', response.data.organization.plan);
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testPlanSelection(); 