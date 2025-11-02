// Test script for email service
require('dotenv').config();
const { sendAbsentStaffEmail, generateAbsenceEmailHTML } = require('./src/services/emailService');

async function testEmailService() {
  try {
    console.log('Testing email service...');
    
    // Test HTML generation
    const html = generateAbsenceEmailHTML({
      userName: 'John Doe',
      absenceDate: '2025-01-27',
      absenceReason: 'Sick leave'
    });
    
    console.log('HTML generated successfully');
    
    // Test email sending (uncomment to test actual sending)
    /*
    const result = await sendAbsentStaffEmail({
      to: 'test@example.com', // Replace with actual test email
      subject: 'Test Absence Notification',
      html: html
    });
    
    console.log('Email sent successfully:', result);
    */
    
    console.log('Email service test completed successfully');
  } catch (error) {
    console.error('Email service test failed:', error);
  }
}

// Run the test
testEmailService(); 