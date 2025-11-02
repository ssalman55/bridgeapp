// Test script for SMTP connection
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSMTPConnection() {
  try {
    console.log('Testing SMTP connection...');
    console.log('Environment variables:');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***SET***' : 'NOT SET');
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'NOT SET');
    
    const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT);
    const isSecurePort = smtpPort === 465;
    
    console.log('\nSMTP Configuration:');
    console.log('Port:', smtpPort);
    console.log('Secure:', isSecurePort);
    console.log('Has Password:', !!smtpPassword);
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: isSecurePort,
      auth: {
        user: process.env.SMTP_USER,
        pass: smtpPassword,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false,
      },
      debug: true,
      logger: true
    });
    
    console.log('\nVerifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Test sending a simple email
    console.log('\nTesting email sending...');
    const result = await transporter.sendMail({
      from: '"Staff Bridge" <support@stfbridge.com>',
      to: 'test@example.com',
      subject: 'SMTP Test',
      text: 'This is a test email to verify SMTP configuration.'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    
  } catch (error) {
    console.error('❌ SMTP test failed:', error);
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
testSMTPConnection(); 