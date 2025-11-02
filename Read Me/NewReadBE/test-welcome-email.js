// Test script for welcome email
require('dotenv').config();
const { sendWelcomeEmail, generateWelcomeEmailHTML } = require('./src/services/emailService');

async function testWelcomeEmail() {
  try {
    console.log('Testing welcome email functionality...');
    
    // Test data
    const testOrganization = {
      _id: 'test-org-id',
      name: 'Test Organization',
      subscriptionStatus: 'trial',
      plan: 'basic'
    };
    
    const testAdmin = {
      fullName: 'John Doe',
      email: 'test@example.com'
    };
    
    const testPlan = 'basic';
    const testTrialStartDate = new Date();
    const testTrialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
    
    // Test HTML generation
    const html = generateWelcomeEmailHTML({
      organization: testOrganization,
      admin: testAdmin,
      plan: testPlan,
      trialStartDate: testTrialStartDate,
      trialEndDate: testTrialEndDate
    });
    
    console.log('✅ HTML generated successfully');
    console.log('HTML length:', html.length);
    
    // Test email sending (uncomment to test actual sending)
    /*
    const result = await sendWelcomeEmail({
      organization: testOrganization,
      admin: testAdmin,
      plan: testPlan,
      trialStartDate: testTrialStartDate,
      trialEndDate: testTrialEndDate
    });
    
    console.log('✅ Welcome email sent successfully!');
    console.log('Message ID:', result.messageId);
    */
    
    console.log('✅ Welcome email test completed successfully');
  } catch (error) {
    console.error('❌ Welcome email test failed:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      message: error.message
    });
  }
}

// Run the test
testWelcomeEmail(); 