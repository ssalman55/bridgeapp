// Test script for payment confirmation email
require('dotenv').config();
const { sendPaymentConfirmationEmail, generatePaymentConfirmationEmailHTML } = require('./src/services/emailService');

async function testPaymentConfirmationEmail() {
  try {
    console.log('Testing payment confirmation email functionality...');
    
    // Test data
    const testOrganization = {
      _id: 'test-org-id',
      name: 'Test Organization',
      plan: 'professional',
      staffLimit: 100,
      subscriptionStatus: 'active',
      subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    };
    
    const testAdmin = {
      fullName: 'John Doe',
      email: 'test@example.com'
    };
    
    const testPayment = {
      amount: 948.00,
      plan: 'professional',
      date: new Date(),
      transactionId: 'pi_test_123456789',
      paymentMethod: 'Stripe',
      currency: 'usd'
    };
    
    const testReceiptUrl = 'https://www.stfbridge.com/billing';
    
    // Test HTML generation
    const html = generatePaymentConfirmationEmailHTML({
      organization: testOrganization,
      admin: testAdmin,
      payment: testPayment,
      receiptUrl: testReceiptUrl
    });
    
    console.log('✅ HTML generated successfully');
    console.log('HTML length:', html.length);
    
    // Test email sending (uncomment to test actual sending)
    /*
    const result = await sendPaymentConfirmationEmail({
      organization: testOrganization,
      admin: testAdmin,
      payment: testPayment,
      receiptUrl: testReceiptUrl
    });
    
    console.log('✅ Payment confirmation email sent successfully!');
    console.log('Message ID:', result.messageId);
    */
    
    console.log('✅ Payment confirmation email test completed successfully');
  } catch (error) {
    console.error('❌ Payment confirmation email test failed:', error);
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
testPaymentConfirmationEmail(); 