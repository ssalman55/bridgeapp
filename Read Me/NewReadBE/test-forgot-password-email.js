// Test script for forgot password email
require('dotenv').config();
const { sendForgotPasswordEmail, generateForgotPasswordEmailHTML } = require('./src/services/emailService');

async function testForgotPasswordEmail() {
  try {
    console.log('Testing forgot password email functionality...');
    
    // Test HTML generation
    const testResetLink = 'https://www.stfbridge.com/reset-password/test-token-123';
    const html = generateForgotPasswordEmailHTML({
      fullName: 'John Doe',
      resetLink: testResetLink
    });
    
    console.log('✅ HTML generated successfully');
    console.log('HTML length:', html.length);
    
    // Test email sending (uncomment to test actual sending)
    /*
    const result = await sendForgotPasswordEmail({
      to: 'test@example.com', // Replace with actual test email
      fullName: 'John Doe',
      resetLink: testResetLink
    });
    
    console.log('✅ Forgot password email sent successfully!');
    console.log('Message ID:', result.messageId);
    */
    
    console.log('✅ Forgot password email test completed successfully');
  } catch (error) {
    console.error('❌ Forgot password email test failed:', error);
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
testForgotPasswordEmail(); 