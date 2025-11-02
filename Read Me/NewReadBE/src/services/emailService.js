const nodemailer = require('nodemailer');

// Validate environment variables
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

// Check for password (can be either SMTP_PASSWORD or SMTP_PASS)
const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
if (!smtpPassword) {
  missingVars.push('SMTP_PASSWORD or SMTP_PASS');
}

if (missingVars.length > 0) {
  console.error('Missing required SMTP environment variables:', missingVars);
  console.error('Please ensure the following variables are set:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
}

// Create transporter with SMTP configuration
const smtpPort = parseInt(process.env.SMTP_PORT);
const isSecurePort = smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: isSecurePort, // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPassword,
  },
  // Add timeout and connection settings for better reliability
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 30000,     // 30 seconds
  // Add TLS settings for secure connections
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
  // Add debug option for troubleshooting
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development',
  // Add pool option for better connection management
  pool: false,
  maxConnections: 1,
  maxMessages: 3,
  // Add additional settings for GoDaddy SMTP
  requireTLS: true,
  ignoreTLS: false
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
    console.error('SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: isSecurePort,
      user: process.env.SMTP_USER,
      hasPassword: !!smtpPassword
    });
  } else {
    console.log('SMTP server is ready to send emails');
    console.log('SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: isSecurePort,
      user: process.env.SMTP_USER
    });
  }
});

/**
 * Send absence notification email using SMTP with retry mechanism
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content of the email
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendAbsentStaffEmail({ to, subject, html }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send email to: ${to} (attempt ${attempt}/${maxRetries})`);
      console.log('Email subject:', subject);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to,
        subject,
        html,
      };

      console.log('Mail options prepared:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        htmlLength: mailOptions.html.length
      });

      const result = await transporter.sendMail(mailOptions);
      console.log('Absence notification email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Error sending absence notification email (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = 'Failed to send email after multiple attempts';
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Send absence notification emails to multiple users
 * @param {Array<{email: string, name: string, reason?: string}>} users - List of users to notify
 * @param {string} date - Absence date (ISO string or formatted)
 * @param {string} [reason] - Absence reason (optional, can be per user)
 * @returns {Promise<{success: string[], failed: string[]}>}
 */
async function sendAbsenceNotificationEmail(users, date, reason) {
  console.log('Starting absence notification email process');
  console.log('Users to notify:', users.length);
  console.log('Date:', date);
  console.log('Reason:', reason);
  
  const uniqueUsers = Array.from(new Map(users.map(u => [u.email, u])).values());
  const results = { success: [], failed: [] };

  for (const user of uniqueUsers) {
    try {
      console.log(`Processing user: ${user.name} (${user.email})`);
      
      const html = generateAbsenceEmailHTML({
        userName: user.name,
        absenceDate: date,
        absenceReason: user.reason || reason || '',
      });

      const subject = `Absence Notification - ${date || 'Today'}`;
      
      await sendAbsentStaffEmail({
        to: user.email,
        subject,
        html,
      });

      console.log(`Successfully sent email to: ${user.email}`);
      results.success.push(user.email);
    } catch (err) {
      console.error(`Failed to send absence notification to ${user.email}:`, err);
      results.failed.push(user.email);
    }
  }

  console.log('Absence notification email process completed');
  console.log('Results:', results);
  
  return results;
}

/**
 * Generate HTML content for absence notification email
 * @param {Object} params
 * @param {string} params.userName - User's full name
 * @param {string} params.absenceDate - Absence date
 * @param {string} params.absenceReason - Absence reason
 * @returns {string} - HTML content for the email
 */
function generateAbsenceEmailHTML({ userName, absenceDate, absenceReason }) {
  const formattedDate = absenceDate ? new Date(absenceDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'today';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Absence Notification</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .notification-box {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .notification-title {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .details {
          background-color: #f8fafc;
          border-radius: 6px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .detail-label {
          font-weight: bold;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .contact-link {
          color: #1C4E80;
          text-decoration: none;
        }
        .contact-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Workforce Management System</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Dear <strong>${userName}</strong>,
          </div>
          
          <div class="notification-box">
            <div class="notification-title">⚠️ Absence Notification</div>
            <p>This is to inform you that you have been marked as absent for <strong>${formattedDate}</strong>.</p>
          </div>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            ${absenceReason ? `
            <div class="detail-row">
              <span class="detail-label">Reason:</span>
              <span class="detail-value">${absenceReason}</span>
            </div>
            ` : ''}
          </div>
          
          <p>If you believe this is an error or if you have any questions regarding this notification, please contact your administrator or HR department.</p>
          
          <p>You can also review your attendance history by logging into your StaffBridge account.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge</p>
          <p>For support, contact <a href="mailto:support@stfbridge.com" class="contact-link">support@stfbridge.com</a></p>
          <p>&copy; 2025 StaffBridge. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send forgot password email using SMTP
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.fullName - Recipient full name
 * @param {string} params.resetLink - Password reset link
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendForgotPasswordEmail({ to, fullName, resetLink }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send forgot password email to: ${to} (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateForgotPasswordEmailHTML({ fullName, resetLink });
      const subject = 'Password Reset Request - StaffBridge';
      
      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to,
        subject,
        html,
      };

      console.log('Forgot password mail options prepared:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        htmlLength: mailOptions.html.length
      });

      const result = await transporter.sendMail(mailOptions);
      console.log('Forgot password email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Error sending forgot password email (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = 'Failed to send forgot password email after multiple attempts';
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for forgot password email
 * @param {Object} params
 * @param {string} params.fullName - User's full name
 * @param {string} params.resetLink - Password reset link
 * @returns {string} - HTML content for the email
 */
function generateForgotPasswordEmailHTML({ fullName, resetLink }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Request</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .reset-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .reset-title {
          color: #0369a1;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .reset-button {
          display: inline-block;
          background-color: #0ea5e9;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          margin: 16px 0;
        }
        .reset-button:hover {
          background-color: #0284c7;
        }
        .warning {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 12px;
          margin: 16px 0;
        }
        .warning-title {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .contact-link {
          color: #1C4E80;
          text-decoration: none;
        }
        .contact-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Workforce Management System</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Dear <strong>${fullName}</strong>,
          </div>
          
          <p>We received a request to reset your password for your StaffBridge account.</p>
          
          <div class="reset-box">
            <div class="reset-title">🔐 Password Reset Request</div>
            <p>Click the button below to reset your password. This link will expire in 1 hour for security reasons.</p>
            <a href="${resetLink}" class="reset-button">Reset My Password</a>
          </div>
          
          <div class="warning">
            <div class="warning-title">⚠️ Security Notice</div>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          
          <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #6B7280; font-size: 0.9rem;">${resetLink}</p>
          
          <p>This link will expire in 1 hour for your security.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email from StaffBridge</p>
          <p>For support, contact <a href="mailto:support@stfbridge.com" class="contact-link">support@stfbridge.com</a></p>
          <p>&copy; 2025 StaffBridge. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send welcome email using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user object
 * @param {string} params.plan - Subscription plan
 * @param {Date} params.trialStartDate - Trial start date
 * @param {Date} params.trialEndDate - Trial end date
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendWelcomeEmail({ organization, admin, plan, trialStartDate, trialEndDate }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send welcome email to: ${admin.email} (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateWelcomeEmailHTML({ organization, admin, plan, trialStartDate, trialEndDate });
      const subject = '🎉 Welcome to StaffBridge – Your Account is Ready!';
      
      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to: admin.email,
        subject,
        html,
      };

      console.log('Welcome email mail options prepared:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        htmlLength: mailOptions.html.length
      });

      const result = await transporter.sendMail(mailOptions);
      console.log('Welcome email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Error sending welcome email (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = 'Failed to send welcome email after multiple attempts';
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for welcome email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user object
 * @param {string} params.plan - Subscription plan
 * @param {Date} params.trialStartDate - Trial start date
 * @param {Date} params.trialEndDate - Trial end date
 * @returns {string} - HTML content for the email
 */
function generateWelcomeEmailHTML({ organization, admin, plan, trialStartDate, trialEndDate }) {
  const trialDaysLeft = getTrialCountdown(trialEndDate);
  const planLabel = getPlanLabel(plan);
  const isTrial = organization.subscriptionStatus === 'trial';
  const paymentUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/billing?org=${organization._id}`;
  const contactUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/contact`;
  const gettingStartedUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/help`;
  const helpUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/help`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .subscription-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .subscription-title {
          color: #0369a1;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .trial-notice {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 12px;
          margin: 16px 0;
        }
        .trial-title {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .cta-button {
          display: inline-block;
          background-color: #EA6A47;
          color: white;
          font-weight: bold;
          padding: 14px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 1.1rem;
          margin: 16px 0;
        }
        .cta-button:hover {
          background-color: #d55a37;
        }
        .features-section {
          margin: 32px 0 16px 0;
        }
        .features-title {
          color: #1C4E80;
          font-size: 1.2rem;
          margin-bottom: 8px;
        }
        .features-list {
          padding-left: 20px;
          font-size: 1rem;
        }
        .features-list li {
          margin-bottom: 8px;
        }
        .getting-started {
          background-color: #f1f5f9;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 16px;
        }
        .getting-started-title {
          font-weight: bold;
          margin-bottom: 8px;
        }
        .getting-started-list {
          padding-left: 20px;
          font-size: 1rem;
        }
        .getting-started-list li {
          margin-bottom: 4px;
        }
        .getting-started-list a {
          color: #1C4E80;
          text-decoration: none;
        }
        .getting-started-list a:hover {
          text-decoration: underline;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .contact-link {
          color: #1C4E80;
          text-decoration: none;
        }
        .contact-link:hover {
          text-decoration: underline;
        }
        .unsubscribe-link {
          color: #EA6A47;
          text-decoration: none;
        }
        .unsubscribe-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Workforce Management System</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hi <strong>${admin.fullName}</strong>,
          </div>
          
          <p>We're thrilled to welcome <strong>${organization.name}</strong> to StaffBridge!</p>
          
          <div class="subscription-box">
            <div class="subscription-title">📋 Subscription Details</div>
            <p><strong>Subscription Type:</strong> ${planLabel}</p>
            ${isTrial ? `<p><strong>Trial Period:</strong> ${trialDaysLeft} days remaining</p>` : ''}
          </div>
          
          ${isTrial ? `
          <div class="trial-notice">
            <div class="trial-title">⏰ Trial Period Active</div>
            <p>You have <strong>${trialDaysLeft} days remaining</strong> in your free trial. Complete your payment to continue enjoying all features.</p>
          </div>
          ` : ''}
          
          <a href="${paymentUrl}" class="cta-button">Complete Your Payment</a>
          
          <div class="features-section">
            <div class="features-title">🚀 What's included in your plan?</div>
            <ul class="features-list">
              <li><strong>All-in-one staff management dashboard</strong> - Centralized control for all your workforce needs</li>
              <li><strong>Attendance tracking & geofencing</strong> - Monitor staff presence with location-based check-ins</li>
              <li><strong>Payroll & expense management</strong> - Streamlined financial processes and reporting</li>
              <li><strong>Document management</strong> - Secure cloud storage for all your important files</li>
              <li><strong>Performance tracking</strong> - Employee evaluations and peer recognition system</li>
              <li><strong>Task management</strong> - Assign and track tasks across your organization</li>
              <li><strong>Inventory management</strong> - Track and manage company assets</li>
              <li><strong>Priority support</strong> - Dedicated support team to help you succeed</li>
            </ul>
          </div>
          
          <div class="getting-started">
            <div class="getting-started-title">🎯 Getting Started</div>
            <ul class="getting-started-list">
              <li><a href="${gettingStartedUrl}">📖 Getting Started Guide</a> - Step-by-step setup instructions</li>
              <li><a href="${helpUrl}">❓ Help Center</a> - Comprehensive documentation and FAQs</li>
              <li><a href="${contactUrl}">📞 Contact Support</a> - Get help when you need it</li>
            </ul>
            ${isTrial ? `<p style="color:#EA6A47;font-weight:bold;margin-top:12px;">⏰ You have ${trialDaysLeft} days remaining in your free trial.</p>` : ''}
          </div>
          
          <p style="margin-top:24px;font-size:1.1rem;">We're excited to have you onboard and can't wait to see how StaffBridge helps transform your workforce management!<br/><br/>– The StaffBridge Team</p>
        </div>
        
        <div class="footer">
          <p>Sent by StaffBridge | 30 N Gould St Ste N, Sheridan, WY 82801</p>
          <p>Questions? <a href="mailto:support@stfbridge.com" class="contact-link">Contact Support</a></p>
          <p><a href="${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/unsubscribe?email=${encodeURIComponent(admin.email)}" class="unsubscribe-link">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get trial countdown days
 * @param {Date} trialEndDate - Trial end date
 * @returns {number} - Days remaining in trial
 */
function getTrialCountdown(trialEndDate) {
  if (!trialEndDate) return 0;
  const now = new Date();
  const end = new Date(trialEndDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Get plan label
 * @param {string} plan - Plan type
 * @returns {string} - Formatted plan label
 */
function getPlanLabel(plan) {
  const planLabels = {
    'basic': 'Basic Plan',
    'professional': 'Professional Plan',
    'enterprise': 'Enterprise Plan'
  };
  return planLabels[plan] || plan || 'Basic Plan';
}

/**
 * Send payment confirmation email using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user object
 * @param {Object} params.payment - Payment record object
 * @param {string} params.receiptUrl - URL to download/view the receipt
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendPaymentConfirmationEmail({ organization, admin, payment, receiptUrl }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send payment confirmation email to: ${admin.email} (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generatePaymentConfirmationEmailHTML({ organization, admin, payment, receiptUrl });
      const subject = '✅ Payment Confirmed - Thank You for Your Subscription!';
      
      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to: admin.email,
        subject,
        html,
      };

      console.log('Payment confirmation email mail options prepared:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        htmlLength: mailOptions.html.length
      });

      const result = await transporter.sendMail(mailOptions);
      console.log('Payment confirmation email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Error sending payment confirmation email (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = 'Failed to send payment confirmation email after multiple attempts';
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for payment confirmation email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user object
 * @param {Object} params.payment - Payment record object
 * @param {string} params.receiptUrl - URL to download/view the receipt
 * @returns {string} - HTML content for the email
 */
function generatePaymentConfirmationEmailHTML({ organization, admin, payment, receiptUrl }) {
  const planLabel = getPlanLabel(organization.plan);
  const nextRenewalDate = organization.subscriptionEndDate ? new Date(organization.subscriptionEndDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'N/A';
  
  const billingUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/billing`;
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/dashboard`;
  const supportUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/contact`;
  const helpUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/help`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Confirmed - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .success-box {
          background-color: #f0fdf4;
          border: 1px solid #22c55e;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .success-title {
          color: #166534;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .payment-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .payment-title {
          color: #1e293b;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .payment-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .payment-label {
          font-weight: 500;
          color: #64748b;
        }
        .payment-value {
          font-weight: 600;
          color: #1e293b;
        }
        .receipt-button {
          display: inline-block;
          background-color: #1C4E80;
          color: white;
          font-weight: bold;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-size: 1rem;
          margin: 16px 0;
        }
        .receipt-button:hover {
          background-color: #0f3a5f;
        }
        .account-details {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .account-title {
          color: #0369a1;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .useful-links {
          background-color: #f1f5f9;
          border-radius: 8px;
          padding: 16px 20px;
          margin: 20px 0;
        }
        .links-title {
          font-weight: bold;
          margin-bottom: 8px;
          color: #1e293b;
        }
        .links-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .links-list li {
          margin-bottom: 8px;
        }
        .links-list a {
          color: #1C4E80;
          text-decoration: none;
          font-weight: 500;
        }
        .links-list a:hover {
          text-decoration: underline;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .contact-link {
          color: #1C4E80;
          text-decoration: none;
        }
        .contact-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Workforce Management System</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hi <strong>${admin.fullName}</strong>,
          </div>
          
          <div class="success-box">
            <div class="success-title">✅ Payment Confirmed!</div>
            <p>Thank you for your payment! Your subscription has been successfully processed and your account is now active.</p>
          </div>
          
          <div class="payment-details">
            <div class="payment-title">📋 Payment Details</div>
            <div class="payment-row">
              <span class="payment-label">Organization:</span>
              <span class="payment-value">${organization.name}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Amount Paid:</span>
              <span class="payment-value">$${payment.amount.toFixed(2)} ${payment.currency?.toUpperCase() || 'USD'}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Plan:</span>
              <span class="payment-value">${planLabel}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Transaction ID:</span>
              <span class="payment-value">${payment.transactionId}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Payment Method:</span>
              <span class="payment-value">${payment.paymentMethod}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Date:</span>
              <span class="payment-value">${new Date(payment.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          </div>
          
          <a href="${receiptUrl}" class="receipt-button">📄 Download Receipt</a>
          
          <div class="account-details">
            <div class="account-title">🏢 Account Information</div>
            <div class="payment-row">
              <span class="payment-label">Subscription Status:</span>
              <span class="payment-value" style="color: #22c55e;">Active</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Plan Type:</span>
              <span class="payment-value">${planLabel}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Staff Limit:</span>
              <span class="payment-value">${organization.staffLimit === 1000000 ? 'Unlimited' : organization.staffLimit} staff members</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Next Renewal:</span>
              <span class="payment-value">${nextRenewalDate}</span>
            </div>
          </div>
          
          <div class="useful-links">
            <div class="links-title">🔗 Useful Links</div>
            <ul class="links-list">
              <li><a href="${dashboardUrl}">📊 Dashboard</a> - Access your main dashboard</li>
              <li><a href="${billingUrl}">💳 Billing</a> - View payment history and manage billing</li>
              <li><a href="${helpUrl}">❓ Help Center</a> - Documentation and FAQs</li>
              <li><a href="${supportUrl}">📞 Support</a> - Contact our support team</li>
            </ul>
          </div>
          
          <p style="margin-top:24px;font-size:1.1rem;">Thank you for choosing StaffBridge! We're excited to help you transform your workforce management.<br/><br/>– The StaffBridge Team</p>
        </div>
        
        <div class="footer">
          <p>Sent by StaffBridge | 30 N Gould St Ste N, Sheridan, WY 82801</p>
          <p>Questions? <a href="mailto:support@stfbridge.com" class="contact-link">Contact Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send peer recognition notification email to all admins in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.admins - Array of admin users to notify
 * @param {Object} params.submitter - User who submitted the recognition
 * @param {Object} params.recognized - User who was recognized
 * @param {string} params.comment - Recognition comment
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendPeerRecognitionEmail({ organization, admins, submitter, recognized, comment }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send peer recognition email to ${admins.length} admins in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generatePeerRecognitionEmailHTML({ organization, submitter, recognized, comment });
      const subject = '🎉 New Peer Recognition Submitted - StaffBridge';
      
      // Send email to all admins (already filtered by organization)
      const emailPromises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending peer recognition email to admin: ${admin.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Peer recognition email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = admins.filter(admin => !successfulEmails.includes(admin.email)).map(admin => admin.email);

      console.log(`Peer recognition emails sent successfully for organization ${organization.name}:`, successfulEmails);
      if (failedEmails.length > 0) {
        console.log(`Failed to send peer recognition emails for organization ${organization.name}:`, failedEmails);
      }

      return { 
        success: true, 
        successfulEmails, 
        failedEmails,
        totalSent: successfulEmails.length,
        totalFailed: failedEmails.length,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending peer recognition emails for organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send peer recognition emails for organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for peer recognition email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the recognition
 * @param {Object} params.recognized - User who was recognized
 * @param {string} params.comment - Recognition comment
 * @returns {string} - HTML content for the email
 */
function generatePeerRecognitionEmailHTML({ organization, submitter, recognized, comment }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/peer-recognitions`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Peer Recognition - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .recognition-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .recognition-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .recognition-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .comment-box {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .comment-label {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .comment-text {
          color: #78350f;
          font-style: italic;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Peer Recognition Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello Admin,
          </div>
          
          <p>A new peer recognition has been submitted in your organization that requires your review.</p>
          
          <div class="recognition-box">
            <div class="recognition-title">🎉 New Peer Recognition</div>
            <div class="recognition-details">
              <div class="detail-row">
                <span class="detail-label">Submitted by:</span>
                <span class="detail-value">${submitter.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Recognized:</span>
                <span class="detail-value">${recognized.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            <div class="comment-box">
              <div class="comment-label">Recognition Comment:</div>
              <div class="comment-text">"${comment}"</div>
            </div>
          </div>
          
          <p>Please review this recognition and take appropriate action (approve or reject) based on your organization's policies.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            Review Recognition
          </a>
          
          <p><strong>Note:</strong> This recognition is currently in <span class="highlight">pending</span> status and requires admin approval before it becomes visible to all staff members.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send expense claim notification email to all admins in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.admins - Array of admin users to notify
 * @param {Object} params.submitter - User who submitted the claim
 * @param {Object} params.claim - Expense claim object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendExpenseClaimEmail({ organization, admins, submitter, claim }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send expense claim email to ${admins.length} admins in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateExpenseClaimEmailHTML({ organization, submitter, claim });
      const subject = '💰 New Expense Claim Submitted - StaffBridge';
      
      // Send email to all admins (already filtered by organization)
      const emailPromises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending expense claim email to admin: ${admin.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Expense claim email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = admins.filter(admin => !successfulEmails.includes(admin.email)).map(admin => admin.email);

      console.log(`Expense claim emails sent successfully for organization ${organization.name}:`, successfulEmails);
      if (failedEmails.length > 0) {
        console.log(`Failed to send expense claim emails for organization ${organization.name}:`, failedEmails);
      }

      return { 
        success: true, 
        successfulEmails, 
        failedEmails,
        totalSent: successfulEmails.length,
        totalFailed: failedEmails.length,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending expense claim emails for organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send expense claim emails for organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for expense claim email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the claim
 * @param {Object} params.claim - Expense claim object
 * @returns {string} - HTML content for the email
 */
function generateExpenseClaimEmailHTML({ organization, submitter, claim }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/expense-claims/pending`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Expense Claim - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .claim-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .claim-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .claim-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .comment-box {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .comment-label {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .comment-text {
          color: #78350f;
          font-style: italic;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Expense Claim Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello Admin,
          </div>
          
          <p>A new expense claim has been submitted in your organization that requires your review.</p>
          
          <div class="claim-box">
            <div class="claim-title">💰 New Expense Claim</div>
            <div class="claim-details">
              <div class="detail-row">
                <span class="detail-label">Submitted by:</span>
                <span class="detail-value">${submitter.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Claim Title:</span>
                <span class="detail-value">${claim.title}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Total Amount:</span>
                <span class="detail-value">$${claim.totalAmount ? claim.totalAmount.toFixed(2) : '0.00'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span class="detail-value">${claim.category}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Expense Date:</span>
                <span class="detail-value">${new Date(claim.expenseDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            ${claim.justification ? `
            <div class="comment-box">
              <div class="comment-label">Justification:</div>
              <div class="comment-text">"${claim.justification}"</div>
            </div>
            ` : ''}
          </div>
          
          <p>Please review this expense claim and take appropriate action (approve or reject) based on your organization's policies.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            Review Expense Claim
          </a>
          
          <p><strong>Note:</strong> This expense claim is currently in <span class="highlight">pending</span> status and requires admin approval before it becomes visible to all staff members.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send leave request notification email to all admins in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.admins - Array of admin users to notify
 * @param {Object} params.submitter - User who submitted the request
 * @param {Object} params.leaveRequest - Leave request object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendLeaveRequestEmail({ organization, admins, submitter, leaveRequest }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send leave request email to ${admins.length} admins in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateLeaveRequestEmailHTML({ organization, submitter, leaveRequest });
      const subject = '🏖️ New Leave Request Submitted - StaffBridge';
      
      // Send email to all admins (already filtered by organization)
      const emailPromises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending leave request email to admin: ${admin.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Leave request email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = admins.filter(admin => !successfulEmails.includes(admin.email)).map(admin => admin.email);

      console.log(`Leave request emails sent successfully for organization ${organization.name}:`, successfulEmails);
      if (failedEmails.length > 0) {
        console.log(`Failed to send leave request emails for organization ${organization.name}:`, failedEmails);
      }

      return { 
        success: true, 
        successfulEmails, 
        failedEmails,
        totalSent: successfulEmails.length,
        totalFailed: failedEmails.length,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending leave request emails for organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send leave request emails for organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for leave request email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the request
 * @param {Object} params.leaveRequest - Leave request object
 * @returns {string} - HTML content for the email
 */
function generateLeaveRequestEmailHTML({ organization, submitter, leaveRequest }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/leave-management`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate number of days
  const startDate = new Date(leaveRequest.startDate);
  const endDate = new Date(leaveRequest.endDate);
  const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Leave Request - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .request-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .request-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .request-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .comment-box {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .comment-label {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .comment-text {
          color: #78350f;
          font-style: italic;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Leave Request Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello Admin,
          </div>
          
          <p>A new leave request has been submitted in your organization that requires your review.</p>
          
          <div class="request-box">
            <div class="request-title">🏖️ New Leave Request</div>
            <div class="request-details">
              <div class="detail-row">
                <span class="detail-label">Submitted by:</span>
                <span class="detail-value">${submitter.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Leave Type:</span>
                <span class="detail-value">${leaveRequest.leaveType || 'Annual'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Start Date:</span>
                <span class="detail-value">${new Date(leaveRequest.startDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">End Date:</span>
                <span class="detail-value">${new Date(leaveRequest.endDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of Days:</span>
                <span class="detail-value">${daysDiff} day${daysDiff > 1 ? 's' : ''}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            ${leaveRequest.reason ? `
            <div class="comment-box">
              <div class="comment-label">Reason:</div>
              <div class="comment-text">"${leaveRequest.reason}"</div>
            </div>
            ` : ''}
          </div>
          
          <p>Please review this leave request and take appropriate action (approve or reject) based on your organization's policies.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            Review Leave Request
          </a>
          
          <p><strong>Note:</strong> This leave request is currently in <span class="highlight">pending</span> status and requires admin approval before it becomes visible to all staff members.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send training request notification email to all admins in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.admins - Array of admin users to notify
 * @param {Object} params.submitter - User who submitted the request
 * @param {Object} params.trainingRequest - Training request object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendTrainingRequestEmail({ organization, admins, submitter, trainingRequest }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send training request email to ${admins.length} admins in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateTrainingRequestEmailHTML({ organization, submitter, trainingRequest });
      const subject = '🎓 New Training Request Submitted - StaffBridge';
      
      // Send email to all admins (already filtered by organization)
      const emailPromises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending training request email to admin: ${admin.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Training request email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = admins.filter(admin => !successfulEmails.includes(admin.email)).map(admin => admin.email);

      console.log(`Training request emails sent successfully for organization ${organization.name}:`, successfulEmails);
      if (failedEmails.length > 0) {
        console.log(`Failed to send training request emails for organization ${organization.name}:`, failedEmails);
      }

      return { 
        success: true, 
        successfulEmails, 
        failedEmails,
        totalSent: successfulEmails.length,
        totalFailed: failedEmails.length,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending training request emails for organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send training request emails for organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for training request email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the request
 * @param {Object} params.trainingRequest - Training request object
 * @returns {string} - HTML content for the email
 */
function generateTrainingRequestEmailHTML({ organization, submitter, trainingRequest }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/training-requests`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Training Request - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .request-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .request-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .request-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .comment-box {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .comment-label {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .comment-text {
          color: #78350f;
          font-style: italic;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Training Request Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello Admin,
          </div>
          
          <p>A new training request has been submitted in your organization that requires your review.</p>
          
          <div class="request-box">
            <div class="request-title">🎓 New Training Request</div>
            <div class="request-details">
              <div class="detail-row">
                <span class="detail-label">Submitted by:</span>
                <span class="detail-value">${submitter.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Training Title:</span>
                <span class="detail-value">${trainingRequest.trainingTitle || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hosted By:</span>
                <span class="detail-value">${trainingRequest.hostedBy || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${trainingRequest.location || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of Days:</span>
                <span class="detail-value">${trainingRequest.numberOfDays || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            ${trainingRequest.justification ? `
            <div class="comment-box">
              <div class="comment-label">Justification:</div>
              <div class="comment-text">"${trainingRequest.justification}"</div>
            </div>
            ` : ''}
          </div>
          
          <p>Please review this training request and take appropriate action (approve or reject) based on your organization's policies.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            Review Training Request
          </a>
          
          <p><strong>Note:</strong> This training request is currently in <span class="highlight">pending</span> status and requires admin approval before it becomes visible to all staff members.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send staff profile completion notification email to all admins in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.admins - Array of admin users to notify
 * @param {Object} params.staff - Staff user who completed their profile
 * @param {Object} params.profile - Staff profile object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendProfileCompletionEmail({ organization, admins, staff, profile }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send profile completion email to ${admins.length} admins in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateProfileCompletionEmailHTML({ organization, staff, profile });
      const subject = '🎯 Staff Profile Completed - StaffBridge';
      
      // Send email to all admins (already filtered by organization)
      const emailPromises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending profile completion email to admin: ${admin.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Profile completion email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = admins.filter(admin => !successfulEmails.includes(admin.email)).map(admin => admin.email);

      console.log(`Profile completion emails sent successfully for organization ${organization.name}:`, successfulEmails);
      if (failedEmails.length > 0) {
        console.log(`Failed to send profile completion emails for organization ${organization.name}:`, failedEmails);
      }

      return { 
        success: true, 
        successfulEmails, 
        failedEmails,
        totalSent: successfulEmails.length,
        totalFailed: failedEmails.length,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending profile completion emails for organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send profile completion emails for organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for profile completion email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.staff - Staff user who completed their profile
 * @param {Object} params.profile - Staff profile object
 * @returns {string} - HTML content for the email
 */
function generateProfileCompletionEmailHTML({ organization, staff, profile }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/staff-profiles`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Staff Profile Completed - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .completion-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .completion-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .completion-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .profile-sections {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .sections-label {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .sections-list {
          color: #78350f;
          margin-left: 16px;
        }
        .sections-list li {
          margin-bottom: 4px;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Profile Completion Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello Admin,
          </div>
          
          <p>A staff member has completed their profile to 100% in your organization.</p>
          
          <div class="completion-box">
            <div class="completion-title">🎯 Profile Completed</div>
            <div class="completion-details">
              <div class="detail-row">
                <span class="detail-label">Staff Member:</span>
                <span class="detail-value">${staff.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${staff.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${staff.department || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Role:</span>
                <span class="detail-value">${staff.role || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Completion Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Completion Percentage:</span>
                <span class="detail-value"><span class="highlight">100%</span></span>
              </div>
            </div>
            
            <div class="profile-sections">
              <div class="sections-label">Completed Profile Sections:</div>
              <ul class="sections-list">
                ${profile.personalInfo ? '<li>✅ Personal Information</li>' : ''}
                ${profile.workExperience && profile.workExperience.length > 0 ? '<li>✅ Work Experience</li>' : ''}
                ${profile.education && profile.education.length > 0 ? '<li>✅ Education</li>' : ''}
                ${profile.medicalHistory ? '<li>✅ Medical History</li>' : ''}
                ${profile.children && profile.children.length > 0 ? '<li>✅ Children Information</li>' : ''}
                ${profile.additionalInfo ? '<li>✅ Additional Information</li>' : ''}
              </ul>
            </div>
          </div>
          
          <p>This staff member's profile is now complete and ready for review. You can view the full profile details in the admin panel.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            View Staff Profile
          </a>
          
          <p><strong>Note:</strong> This staff member's profile is now <span class="highlight">100% complete</span> and all required information has been provided.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send bank details submission notification email to all admins in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.admins - Array of admin users to notify
 * @param {Object} params.staff - Staff user who submitted bank details
 * @param {Object} params.bankDetails - Bank details object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendBankDetailsEmail({ organization, admins, staff, bankDetails }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send bank details email to ${admins.length} admins in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateBankDetailsEmailHTML({ organization, staff, bankDetails });
      const subject = '🏦 New Bank Details Submitted - StaffBridge';
      
      // Send email to all admins (already filtered by organization)
      const emailPromises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending bank details email to admin: ${admin.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Bank details email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = admins.filter(admin => !successfulEmails.includes(admin.email)).map(admin => admin.email);

      console.log(`Bank details emails sent successfully for organization ${organization.name}:`, successfulEmails);
      if (failedEmails.length > 0) {
        console.log(`Failed to send bank details emails for organization ${organization.name}:`, failedEmails);
      }

      return { 
        success: true, 
        successfulEmails, 
        failedEmails,
        totalSent: successfulEmails.length,
        totalFailed: failedEmails.length,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending bank details emails for organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send bank details emails for organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for bank details email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.staff - Staff user who submitted bank details
 * @param {Object} params.bankDetails - Bank details object
 * @returns {string} - HTML content for the email
 */
function generateBankDetailsEmailHTML({ organization, staff, bankDetails }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/payroll/bank-details`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Bank Details Submitted - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .bank-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .bank-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .bank-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Bank Details Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello Admin,
          </div>
          
          <p>A staff member has submitted their bank details for verification in your organization.</p>
          
          <div class="bank-box">
            <div class="bank-title">🏦 New Bank Details</div>
            <div class="bank-details">
              <div class="detail-row">
                <span class="detail-label">Staff Member:</span>
                <span class="detail-value">${staff.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${staff.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Account Holder:</span>
                <span class="detail-value">${bankDetails.account_holder_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Bank Name:</span>
                <span class="detail-value">${bankDetails.bank_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">IBAN:</span>
                <span class="detail-value">${bankDetails.maskedIBAN || bankDetails.IBAN}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Currency:</span>
                <span class="detail-value">${bankDetails.currency}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
          </div>
          
          <p>Please review these bank details and verify them for payroll processing. The staff member will be notified once the verification is complete.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            Review Bank Details
          </a>
          
          <p><strong>Note:</strong> These bank details are currently in <span class="highlight">pending verification</span> status and require admin approval before they can be used for payroll processing.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send task status change notification email to the admin who created the task using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user who created the task
 * @param {Object} params.staff - Staff user who updated the task status
 * @param {Object} params.task - Task object
 * @param {string} params.oldStatus - Previous status of the task
 * @param {string} params.newStatus - New status of the task
 * @param {string} params.note - Optional note added by staff
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendTaskStatusChangeEmail({ organization, admin, staff, task, oldStatus, newStatus, note }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send task status change email to admin: ${admin.email} in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateTaskStatusChangeEmailHTML({ organization, admin, staff, task, oldStatus, newStatus, note });
      const subject = `📋 Task Status Updated - ${task.title} - StaffBridge`;
      
      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to: admin.email,
        subject,
        html,
      };

      console.log(`Sending task status change email to admin: ${admin.email} (Organization: ${organization.name})`);
      const result = await transporter.sendMail(mailOptions);
      console.log(`Task status change email sent successfully to ${admin.email} (Organization: ${organization.name}):`, result.messageId);

      return { 
        success: true, 
        email: admin.email,
        messageId: result.messageId,
        organization: organization.name,
        organizationId: organization._id
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending task status change email to admin ${admin.email} in organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = `Failed to send task status change email to admin ${admin.email} in organization ${organization.name} after multiple attempts`;
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for task status change email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user who created the task
 * @param {Object} params.staff - Staff user who updated the task status
 * @param {Object} params.task - Task object
 * @param {string} params.oldStatus - Previous status of the task
 * @param {string} params.newStatus - New status of the task
 * @param {string} params.note - Optional note added by staff
 * @returns {string} - HTML content for the email
 */
function generateTaskStatusChangeEmailHTML({ organization, admin, staff, task, oldStatus, newStatus, note }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/admin/tasks`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return '✅';
      case 'In Progress': return '🔄';
      case 'Pending': return '⏳';
      default: return '📋';
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Task Status Updated - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .task-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .task-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .task-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
        }
        .status-change {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .status-change-title {
          color: #92400e;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          margin: 0 4px;
        }
        .note-box {
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .note-label {
          color: #374151;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .note-text {
          color: #1f2937;
          font-style: italic;
        }
        .action-button {
          display: inline-block;
          background-color: #1C4E80;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .action-button:hover {
          background-color: #0f3a5f;
        }
        .footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #1C4E80;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Task Status Update Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello ${admin.fullName},
          </div>
          
          <p>A task you created has been updated by a staff member in your organization.</p>
          
          <div class="task-box">
            <div class="task-title">📋 Task Status Updated</div>
            <div class="task-details">
              <div class="detail-row">
                <span class="detail-label">Task Title:</span>
                <span class="detail-value">${task.title}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Updated by:</span>
                <span class="detail-value">${staff.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Staff Email:</span>
                <span class="detail-value">${staff.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value">${task.priority}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Due Date:</span>
                <span class="detail-value">${new Date(task.endDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Update Date:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            <div class="status-change">
              <div class="status-change-title">🔄 Status Change</div>
              <div>
                <span class="status-badge ${getStatusColor(oldStatus)}">${getStatusIcon(oldStatus)} ${oldStatus}</span>
                <span style="margin: 0 8px; color: #6B7280;">→</span>
                <span class="status-badge ${getStatusColor(newStatus)}">${getStatusIcon(newStatus)} ${newStatus}</span>
              </div>
            </div>
            
            ${note ? `
            <div class="note-box">
              <div class="note-label">📝 Staff Note:</div>
              <div class="note-text">"${note}"</div>
            </div>
            ` : ''}
          </div>
          
          <p>You can view the updated task details and any additional notes in the admin panel.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            View Task Details
          </a>
          
          <p><strong>Note:</strong> This task status has been updated to <span class="highlight">${newStatus}</span> by ${staff.fullName}.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send bulletin board post notification email to all users in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.users - Array of users to notify (filtered by organization)
 * @param {Object} params.admin - Admin user who created the post
 * @param {Object} params.post - Bulletin post object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendBulletinPostEmail({ organization, users, admin, post }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send bulletin post email to ${users.length} users in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateBulletinPostEmailHTML({ organization, admin, post });
      const subject = `📢 New Announcement: ${post.title} - StaffBridge`;
      
      // Send email to all users in the organization
      const emailPromises = users.map(async (user) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: user.email,
          subject,
          html,
        };

        console.log(`Sending bulletin post email to user: ${user.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Bulletin post email sent successfully to ${user.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: user.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = results.filter(r => !r.success).map(r => r.email);

      console.log(`Bulletin post email results for organization ${organization.name}:`, {
        totalUsers: users.length,
        successfulEmails: successfulEmails.length,
        failedEmails: failedEmails.length,
        successfulEmails,
        failedEmails
      });

      return { 
        success: true, 
        totalUsers: users.length,
        successfulEmails: successfulEmails.length,
        failedEmails: failedEmails.length,
        successfulEmails,
        failedEmails,
        organization: organization.name,
        organizationId: organization._id
      };

    } catch (error) {
      lastError = error;
      console.error(`Error sending bulletin post email to users in organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // If all attempts failed, throw an error with details
  let errorMessage = 'Failed to send bulletin post emails after multiple attempts.';
  
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Clean and format HTML content for email display
 * @param {string} htmlContent - Raw HTML content
 * @returns {string} - Cleaned HTML content safe for email
 */
function cleanHTMLForEmail(htmlContent) {
  if (!htmlContent) return '';
  
  // Remove any potentially dangerous tags and attributes
  const cleanContent = htmlContent
    // Keep basic formatting tags
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    // Clean up common formatting
    .replace(/<p><\/p>/gi, '') // Remove empty paragraphs
    .replace(/<p>\s*<\/p>/gi, '') // Remove paragraphs with only whitespace
    .replace(/(<p[^>]*>)\s*(<\/p>)/gi, '') // Remove empty paragraphs with attributes
    // Ensure proper paragraph spacing
    .replace(/<\/p>\s*<p>/gi, '</p><p style="margin: 8px 0;">')
    .replace(/<p>/gi, '<p style="margin: 8px 0;">')
    // Style other common elements
    .replace(/<h1>/gi, '<h1 style="color: #1f2937; margin: 16px 0 8px 0;">')
    .replace(/<h2>/gi, '<h2 style="color: #374151; margin: 14px 0 6px 0;">')
    .replace(/<h3>/gi, '<h3 style="color: #4b5563; margin: 12px 0 4px 0;">')
    .replace(/<ul>/gi, '<ul style="margin: 8px 0; padding-left: 20px;">')
    .replace(/<ol>/gi, '<ol style="margin: 8px 0; padding-left: 20px;">')
    .replace(/<li>/gi, '<li style="margin: 4px 0;">')
    .replace(/<strong>/gi, '<strong style="color: #374151;">')
    .replace(/<em>/gi, '<em style="color: #6b7280;">')
    // Handle line breaks
    .replace(/<br\s*\/?>/gi, '<br style="line-height: 1.4;">');
    
  return cleanContent;
}

/**
 * Generate HTML for bulletin post notification email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user who created the post
 * @param {Object} params.post - Bulletin post object
 * @returns {string} - HTML content for the email
 */
function generateBulletinPostEmailHTML({ organization, admin, post }) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bulletin-board`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Announcement - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .announcement-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .announcement-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .announcement-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #6B7280;
        }
        .announcement-body {
          background-color: #fefefe;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          line-height: 1.7;
          color: #374151;
        }
        .announcement-body p {
          margin: 8px 0;
        }
        .announcement-body h1, .announcement-body h2, .announcement-body h3 {
          margin-top: 16px;
          margin-bottom: 8px;
        }
        .announcement-body ul, .announcement-body ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .announcement-body li {
          margin: 4px 0;
        }
        .action-button {
          display: inline-block;
          background-color: #0ea5e9;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          transition: background-color 0.2s;
        }
        .action-button:hover {
          background-color: #0284c7;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #0c4a6e;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📢 StaffBridge</div>
          <div class="subtitle">New Announcement Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello! A new announcement has been posted in your organization.
          </div>
          
          <div class="announcement-box">
            <div class="announcement-title">📢 New Announcement</div>
            <div class="announcement-details">
              <div class="detail-row">
                <span class="detail-label">Title:</span>
                <span class="detail-value">${post.title}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Posted by:</span>
                <span class="detail-value">${admin.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Admin Email:</span>
                <span class="detail-value">${admin.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Posted on:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            <div class="announcement-body">
              ${cleanHTMLForEmail(post.body)}
            </div>
          </div>
          
          <p>You can view the full announcement and any attached images in the bulletin board.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            View Announcement
          </a>
          
          <p><strong>Note:</strong> This announcement was posted by ${admin.fullName} in your organization.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send calendar event notification email to all users in an organization using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Array} params.users - Array of users to notify (filtered by organization)
 * @param {Object} params.admin - Admin user who created the event
 * @param {Object} params.event - Calendar event object
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendCalendarEventEmail({ organization, users, admin, event }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send calendar event email to ${users.length} users in organization: ${organization.name} (${organization._id}) (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateCalendarEventEmailHTML({ organization, admin, event });
      const subject = `📅 New Event: ${event.title} - StaffBridge`;
      
      // Send email to all users in the organization
      const emailPromises = users.map(async (user) => {
        const mailOptions = {
          from: '"Staff Bridge" <support@stfbridge.com>',
          to: user.email,
          subject,
          html,
        };

        console.log(`Sending calendar event email to user: ${user.email} (Organization: ${organization.name})`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Calendar event email sent successfully to ${user.email} (Organization: ${organization.name}):`, result.messageId);
        return { success: true, email: user.email, messageId: result.messageId };
      });

      const results = await Promise.all(emailPromises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = results.filter(r => !r.success).map(r => r.email);

      console.log(`Calendar event email results for organization ${organization.name}:`, {
        totalUsers: users.length,
        successfulEmails: successfulEmails.length,
        failedEmails: failedEmails.length,
        successfulEmails,
        failedEmails
      });

      return { 
        success: true, 
        totalUsers: users.length,
        successfulEmails: successfulEmails.length,
        failedEmails: failedEmails.length,
        successfulEmails,
        failedEmails,
        organization: organization.name,
        organizationId: organization._id
      };

    } catch (error) {
      lastError = error;
      console.error(`Error sending calendar event email to users in organization ${organization.name} (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // If all attempts failed, throw an error with details
  let errorMessage = 'Failed to send calendar event emails after multiple attempts.';
  
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML for calendar event notification email
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin user who created the event
 * @param {Object} params.event - Calendar event object
 * @returns {string} - HTML content for the email
 */
function generateCalendarEventEmailHTML({ organization, admin, event }) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar`;
  
  // Format event date and time
  const eventDate = new Date(event.date || event.start).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const eventTime = event.time || (event.start ? new Date(event.start).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }) : 'TBD');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Calendar Event - StaffBridge</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 2rem;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 1rem;
        }
        .content {
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 1.1rem;
          margin-bottom: 16px;
        }
        .event-box {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .event-title {
          color: #0c4a6e;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
        }
        .event-details {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #6B7280;
        }
        .event-description {
          background-color: #fefefe;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          line-height: 1.7;
          color: #374151;
        }
        .event-description p {
          margin: 8px 0;
        }
        .event-description h1, .event-description h2, .event-description h3 {
          margin-top: 16px;
          margin-bottom: 8px;
        }
        .event-description ul, .event-description ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .event-description li {
          margin: 4px 0;
        }
        .action-button {
          display: inline-block;
          background-color: #0ea5e9;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          transition: background-color 0.2s;
        }
        .action-button:hover {
          background-color: #0284c7;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
        }
        .highlight {
          color: #0c4a6e;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📅 StaffBridge</div>
          <div class="subtitle">New Calendar Event Notification</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello! A new calendar event has been created in your organization.
          </div>
          
          <div class="event-box">
            <div class="event-title">📅 New Calendar Event</div>
            <div class="event-details">
              <div class="detail-row">
                <span class="detail-label">Event Title:</span>
                <span class="detail-value">${event.title}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Created by:</span>
                <span class="detail-value">${admin.fullName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Admin Email:</span>
                <span class="detail-value">${admin.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${eventDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${eventTime}</span>
              </div>
              ${event.location ? `
              <div class="detail-row">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${event.location}</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Created on:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            ${event.description ? `
            <div class="event-description">
              ${cleanHTMLForEmail(event.description)}
            </div>
            ` : ''}
          </div>
          
          <p>You can view the full event details and add it to your calendar in the calendar section.</p>
          
          <a href="${dashboardUrl}" class="action-button">
            View Calendar
          </a>
          
          <p><strong>Note:</strong> This event was created by ${admin.fullName} in your organization.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send peer recognition APPROVAL email to the submitter using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the recognition (recipient)
 * @param {Object} params.recognized - User who was recognized
 * @param {Object} params.admin - Admin user who approved
 * @param {string} params.comment - Recognition comment
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendPeerRecognitionApprovalEmail({ organization, submitter, recognized, admin, comment }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');

      const html = generatePeerRecognitionApprovalEmailHTML({ organization, submitter, recognized, admin, comment });
      const subject = '✅ Your Peer Recognition Has Been Approved - StaffBridge';

      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to: submitter.email,
        subject,
        html,
      };

      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }

  let errorMessage = 'Failed to send peer recognition approval email after multiple attempts.';
  if (lastError?.code === 'EAUTH') errorMessage = 'SMTP authentication failed. Please check your credentials.';
  else if (lastError?.code === 'ECONNECTION') errorMessage = 'SMTP connection failed. Please check your server settings.';
  else if (lastError?.code === 'ETIMEDOUT') errorMessage = 'SMTP connection timed out. Please try again.';
  else if (lastError?.response) errorMessage = `SMTP server error: ${lastError.response}`;
  throw new Error(errorMessage);
}

/**
 * Generate HTML for peer recognition approval email to submitter
 * @param {Object} params
 * @param {Object} params.organization
 * @param {Object} params.submitter
 * @param {Object} params.recognized
 * @param {Object} params.admin
 * @param {string} params.comment
 * @returns {string}
 */
function generatePeerRecognitionApprovalEmailHTML({ organization, submitter, recognized, admin, comment }) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/peer-recognition`;
  const safeComment = cleanHTMLForEmail(comment || '');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Peer Recognition Approved - StaffBridge</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7f9fb; }
        .container { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
        .logo { font-size: 2rem; font-weight: 700; color: #1C4E80; }
        .subtitle { color: #6B7280; }
        .box { background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .label { font-weight: 600; color: #374151; }
        .value { color: #1f2937; }
        .comment { background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 12px; color: #374151; }
        .comment p { margin: 8px 0; }
        .action-button { display: inline-block; background: #1C4E80; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
        .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6B7280; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">Peer Recognition Approved</div>
        </div>
        <p>Hello ${submitter.fullName},</p>
        <p>Your peer recognition request has been <strong>approved</strong>.</p>
        <div class="box">
          <div class="row"><span class="label">Recognized:</span><span class="value">${recognized.fullName}</span></div>
          <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
          <div class="row"><span class="label">Approved by:</span><span class="value">${admin.fullName} (${admin.email})</span></div>
          <div class="row"><span class="label">Approved on:</span><span class="value">${currentDate}</span></div>
          ${safeComment ? `<div class="comment">${safeComment}</div>` : ''}
        </div>
        <a class="action-button" href="${dashboardUrl}">View Recognitions</a>
        <div class="footer">
          <p>This is an automated notification from StaffBridge.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send EXPENSE CLAIM APPROVAL email to the submitter using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the claim (recipient)
 * @param {Object} params.admin - Admin user who approved
 * @param {Object} params.claim - Expense claim document
 * @param {string} [params.adminComment] - Optional admin comment
 */
async function sendExpenseClaimApprovalEmail({ organization, submitter, admin, claim, adminComment }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateExpenseClaimApprovalEmailHTML({ organization, submitter, admin, claim, adminComment });
      const subject = `✅ Expense Claim Approved - ${claim.title}`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  let msg = 'Failed to send expense claim approval email after multiple attempts.';
  if (lastError?.code === 'EAUTH') msg = 'SMTP authentication failed. Please check your credentials.';
  else if (lastError?.code === 'ECONNECTION') msg = 'SMTP connection failed. Please check your server settings.';
  else if (lastError?.code === 'ETIMEDOUT') msg = 'SMTP connection timed out. Please try again.';
  else if (lastError?.response) msg = `SMTP server error: ${lastError.response}`;
  throw new Error(msg);
}

function generateExpenseClaimApprovalEmailHTML({ organization, submitter, admin, claim, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/expense-claims`;
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  const currency = claim.currency || 'USD';
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Expense Claim Approved - StaffBridge</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
      .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
      .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
      .logo{font-size:2rem;font-weight:700;color:#1C4E80}
      .subtitle{color:#6B7280}
      .box{background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:20px;margin:20px 0}
      .row{display:flex;justify-content:space-between;margin-bottom:8px}
      .label{font-weight:600;color:#374151}
      .value{color:#1f2937}
      .comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}
      .comment p{margin:8px 0}
      .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
      .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">StaffBridge</div>
        <div class="subtitle">Expense Claim Approved</div>
      </div>
      <p>Hello ${submitter.fullName},</p>
      <p>Your expense claim has been <strong>approved</strong>.</p>
      <div class="box">
        <div class="row"><span class="label">Title:</span><span class="value">${claim.title}</span></div>
        <div class="row"><span class="label">Amount:</span><span class="value">${currency} ${Number(claim.totalAmount).toLocaleString()}</span></div>
        <div class="row"><span class="label">Category:</span><span class="value">${claim.category}</span></div>
        <div class="row"><span class="label">Approved by:</span><span class="value">${admin.fullName} (${admin.email})</span></div>
        <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
        <div class="row"><span class="label">Approved on:</span><span class="value">${currentDate}</span></div>
        ${safeComment ? `<div class="comment">${safeComment}</div>` : ''}
      </div>
      <a class="action-button" href="${dashboardUrl}">View My Claims</a>
      <div class="footer">
        <p>This is an automated notification from StaffBridge.</p>
        <p>If you have any questions, please contact your system administrator.</p>
      </div>
    </div>
  </body>
  </html>`;
}

/**
 * Send LEAVE APPROVAL email to the submitter using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the leave request (recipient)
 * @param {Object} params.admin - Admin who approved
 * @param {Object} params.leave - LeaveRequest document
 */
async function sendLeaveApprovalEmail({ organization, submitter, admin, leave }) {
  const maxRetries = 3; let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateLeaveApprovalEmailHTML({ organization, submitter, admin, leave });
      const subject = `✅ Leave Approved (${leave.leaveType})`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) {
      lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send leave approval email after multiple attempts.');
}

function generateLeaveApprovalEmailHTML({ organization, submitter, admin, leave }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/my-leave-requests`;
  const start = new Date(leave.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const end = new Date(leave.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const safeReason = leave.reason ? cleanHTMLForEmail(leave.reason) : '';
  return `
  <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Leave Approved - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}.value{color:#1f2937}
    .reason{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}
    .reason p{margin:8px 0}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style></head>
  <body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Leave Approved</div></div>
  <p>Hello ${submitter.fullName},</p><p>Your leave request has been <strong>approved</strong>.</p>
  <div class="box">
    <div class="row"><span class="label">Type:</span><span class="value">${leave.leaveType}</span></div>
    <div class="row"><span class="label">Dates:</span><span class="value">${start} to ${end}</span></div>
    <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
    <div class="row"><span class="label">Approved by:</span><span class="value">${admin.fullName} (${admin.email})</span></div>
    <div class="row"><span class="label">Approved on:</span><span class="value">${currentDate}</span></div>
    ${safeReason ? `<div class="reason">${safeReason}</div>` : ''}
  </div>
  <a class="action-button" href="${dashboardUrl}">View My Leave Requests</a>
  <div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div>
  </div></body></html>`;
}

/**
 * Send TRAINING REQUEST APPROVAL email to the submitter using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.submitter - User who submitted the training request (recipient)
 * @param {Object} params.admin - Admin who approved
 * @param {Object} params.request - TrainingRequest document
 */
async function sendTrainingRequestApprovalEmail({ organization, submitter, admin, request }) {
  const maxRetries = 3; let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateTrainingRequestApprovalEmailHTML({ organization, submitter, admin, request });
      const subject = `✅ Training Request Approved - ${request.trainingTitle}`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); }
  }
  throw new Error('Failed to send training request approval email after multiple attempts.');
}

function generateTrainingRequestApprovalEmailHTML({ organization, submitter, admin, request }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/my-training-requests`;
  const safeJustification = request.justification ? cleanHTMLForEmail(request.justification) : '';
  return `
  <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Request Approved - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}.value{color:#1f2937}
    .comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}
    .comment p{margin:8px 0}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style></head>
  <body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Training Request Approved</div></div>
  <p>Hello ${submitter.fullName},</p><p>Your training request has been <strong>approved</strong>.</p>
  <div class="box">
    <div class="row"><span class="label">Title:</span><span class="value">${request.trainingTitle}</span></div>
    <div class="row"><span class="label">Hosted by:</span><span class="value">${request.hostedBy}</span></div>
    <div class="row"><span class="label">Location:</span><span class="value">${request.location}</span></div>
    <div class="row"><span class="label">Days:</span><span class="value">${request.numberOfDays}</span></div>
    <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
    <div class="row"><span class="label">Approved by:</span><span class="value">${admin.fullName} (${admin.email})</span></div>
    <div class="row"><span class="label">Approved on:</span><span class="value">${currentDate}</span></div>
    ${safeJustification ? `<div class="comment">${safeJustification}</div>` : ''}
  </div>
  <a class="action-button" href="${dashboardUrl}">View My Training Requests</a>
  <div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div>
  </div></body></html>`;
}

/**
 * Send NEW TASK email to each assigned staff using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization object
 * @param {Object} params.admin - Admin who created the task
 * @param {Array<{_id:string, fullName:string, email:string}>} params.assignedUsers - Staff assigned (same org)
 * @param {Object} params.task - Task document
 */
async function sendNewTaskAssignedEmail({ organization, admin, assignedUsers, task }) {
  const maxRetries = 3; let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const subject = `📝 New Task Assigned: ${task.title}`;
      const html = generateNewTaskAssignedEmailHTML({ organization, admin, task });
      const promises = assignedUsers.map(async (user) => {
        const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: user.email, subject, html };
        const result = await transporter.sendMail(mailOptions);
        return { success: true, email: user.email, messageId: result.messageId };
      });
      const results = await Promise.all(promises);
      const successfulEmails = results.filter(r => r.success).map(r => r.email);
      const failedEmails = assignedUsers.filter(u => !successfulEmails.includes(u.email)).map(u => u.email);
      return { success: true, successfulEmails, failedEmails };
    } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); }
  }
  throw new Error('Failed to send new task emails after multiple attempts.');
}

function generateNewTaskAssignedEmailHTML({ organization, admin, task }) {
  const start = new Date(task.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const end = new Date(task.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/my-tasks`;
  const safeDescription = task.description ? cleanHTMLForEmail(task.description) : '';
  return `
  <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Task Assigned - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}.value{color:#1f2937}
    .desc{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}
    .desc p{margin:8px 0}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style></head>
  <body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">New Task Assigned</div></div>
  <p>Hello,</p><p>You have been assigned a new task.</p>
  <div class="box">
    <div class="row"><span class="label">Title:</span><span class="value">${task.title}</span></div>
    <div class="row"><span class="label">Priority:</span><span class="value">${task.priority}</span></div>
    <div class="row"><span class="label">Start Date:</span><span class="value">${start}</span></div>
    <div class="row"><span class="label">End Date:</span><span class="value">${end}</span></div>
    <div class="row"><span class="label">Created by:</span><span class="value">${admin.fullName} (${admin.email})</span></div>
    <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
    ${safeDescription ? `<div class="desc">${safeDescription}</div>` : ''}
  </div>
  <a class="action-button" href="${dashboardUrl}">View My Tasks</a>
  <div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div>
  </div></body></html>`;
}

/**
 * Send EXPENSE CLAIM REJECTION email to the submitter
 */
async function sendExpenseClaimRejectionEmail({ organization, submitter, admin, claim, adminComment }) {
  const maxRetries = 3; let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateExpenseClaimRejectionEmailHTML({ organization, submitter, admin, claim, adminComment });
      const subject = `❌ Expense Claim Rejected - ${claim.title}`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); }
  }
  throw new Error('Failed to send expense claim rejection email after multiple attempts.');
}

function generateExpenseClaimRejectionEmailHTML({ organization, submitter, admin, claim, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/expense-claims`;
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  const currency = claim.currency || 'USD';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Expense Claim Rejected - StaffBridge</title><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#fef2f2}.container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #fee2e2}.logo{font-size:2rem;font-weight:700;color:#b91c1c}.subtitle{color:#b91c1c}.box{background:#fff1f2;border:1px solid #fda4af;border-radius:8px;padding:20px;margin:20px 0}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{font-weight:600;color:#374151}.value{color:#1f2937}.comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}.comment p{margin:8px 0}.action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}</style></head>
  <body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Expense Claim Rejected</div></div>
  <p>Hello ${submitter.fullName},</p><p>Your expense claim was <strong>rejected</strong>.</p>
  <div class="box"><div class="row"><span class="label">Title:</span><span class="value">${claim.title}</span></div><div class="row"><span class="label">Amount:</span><span class="value">${currency} ${Number(claim.totalAmount).toLocaleString()}</span></div><div class="row"><span class="label">Category:</span><span class="value">${claim.category}</span></div><div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div><div class="row"><span class="label">Reviewed by:</span><span class="value">${admin.fullName} (${admin.email})</span></div><div class="row"><span class="label">Reviewed on:</span><span class="value">${currentDate}</span></div>${safeComment ? `<div class="comment">${safeComment}</div>` : ''}</div>
  <a class="action-button" href="${dashboardUrl}">View My Claims</a><div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div></div></body></html>`;
}

/**
 * Send TRAINING REQUEST REJECTION email to the submitter
 */
async function sendTrainingRequestRejectionEmail({ organization, submitter, admin, request, adminComment }) {
  const maxRetries = 3; let lastError; for (let attempt = 1; attempt <= maxRetries; attempt++) { try { if (!transporter) throw new Error('SMTP transporter not initialized'); const html = generateTrainingRequestRejectionEmailHTML({ organization, submitter, admin, request, adminComment }); const subject = `❌ Training Request Rejected - ${request.trainingTitle}`; const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html }; const result = await transporter.sendMail(mailOptions); return { success: true, email: submitter.email, messageId: result.messageId }; } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); } } throw new Error('Failed to send training request rejection email after multiple attempts.');
}

function generateTrainingRequestRejectionEmailHTML({ organization, submitter, admin, request, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/my-training-requests`;
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Training Request Rejected - StaffBridge</title><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#fef2f2}.container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #fee2e2}.logo{font-size:2rem;font-weight:700;color:#b91c1c}.subtitle{color:#b91c1c}.box{background:#fff1f2;border:1px solid #fda4af;border-radius:8px;padding:20px;margin:20px 0}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{font-weight:600;color:#374151}.value{color:#1f2937}.comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}.comment p{margin:8px 0}.action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}</style></head><body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Training Request Rejected</div></div><p>Hello ${submitter.fullName},</p><p>Your training request was <strong>rejected</strong>.</p><div class="box"><div class="row"><span class="label">Title:</span><span class="value">${request.trainingTitle}</span></div><div class="row"><span class="label">Hosted by:</span><span class="value">${request.hostedBy}</span></div><div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div><div class="row"><span class="label">Reviewed by:</span><span class="value">${admin.fullName} (${admin.email})</span></div><div class="row"><span class="label">Reviewed on:</span><span class="value">${currentDate}</span></div>${safeComment ? `<div class="comment">${safeComment}</div>` : ''}</div><a class="action-button" href="${dashboardUrl}">View My Training Requests</a><div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div></div></body></html>`;
}

/**
 * Send LEAVE REJECTION email to the submitter
 */
async function sendLeaveRejectionEmail({ organization, submitter, admin, leave, adminComment }) {
  const maxRetries = 3; let lastError; for (let attempt = 1; attempt <= maxRetries; attempt++) { try { if (!transporter) throw new Error('SMTP transporter not initialized'); const html = generateLeaveRejectionEmailHTML({ organization, submitter, admin, leave, adminComment }); const subject = `❌ Leave Request Rejected (${leave.leaveType})`; const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html }; const result = await transporter.sendMail(mailOptions); return { success: true, email: submitter.email, messageId: result.messageId }; } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); } } throw new Error('Failed to send leave rejection email after multiple attempts.');
}

function generateLeaveRejectionEmailHTML({ organization, submitter, admin, leave, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/my-leave-requests`;
  const start = new Date(leave.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const end = new Date(leave.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Leave Request Rejected - StaffBridge</title><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#fef2f2}.container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #fee2e2}.logo{font-size:2rem;font-weight:700;color:#b91c1c}.subtitle{color:#b91c1c}.box{background:#fff1f2;border:1px solid #fda4af;border-radius:8px;padding:20px;margin:20px 0}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{font-weight:600;color:#374151}.value{color:#1f2937}.comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}.comment p{margin:8px 0}.action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}</style></head><body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Leave Request Rejected</div></div><p>Hello ${submitter.fullName},</p><p>Your leave request was <strong>rejected</strong>.</p><div class="box"><div class="row"><span class="label">Type:</span><span class="value">${leave.leaveType}</span></div><div class="row"><span class="label">Dates:</span><span class="value">${start} to ${end}</span></div><div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div><div class="row"><span class="label">Reviewed by:</span><span class="value">${admin.fullName} (${admin.email})</span></div><div class="row"><span class="label">Reviewed on:</span><span class="value">${currentDate}</span></div>${safeComment ? `<div class="comment">${safeComment}</div>` : ''}</div><a class="action-button" href="${dashboardUrl}">View My Leave Requests</a><div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div></div></body></html>`;
}

/**
 * Send PEER RECOGNITION REJECTION email to the submitter
 */
async function sendPeerRecognitionRejectionEmail({ organization, submitter, admin, recognized, adminNote }) {
  const maxRetries = 3; let lastError; for (let attempt = 1; attempt <= maxRetries; attempt++) { try { if (!transporter) throw new Error('SMTP transporter not initialized'); const html = generatePeerRecognitionRejectionEmailHTML({ organization, submitter, admin, recognized, adminNote }); const subject = '❌ Peer Recognition Rejected - StaffBridge'; const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html }; const result = await transporter.sendMail(mailOptions); return { success: true, email: submitter.email, messageId: result.messageId }; } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); } } throw new Error('Failed to send peer recognition rejection email after multiple attempts.');
}

function generatePeerRecognitionRejectionEmailHTML({ organization, submitter, admin, recognized, adminNote }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/peer-recognition`;
  const safeNote = adminNote ? cleanHTMLForEmail(adminNote) : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Peer Recognition Rejected - StaffBridge</title><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#fef2f2}.container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #fee2e2}.logo{font-size:2rem;font-weight:700;color:#b91c1c}.subtitle{color:#b91c1c}.box{background:#fff1f2;border:1px solid #fda4af;border-radius:8px;padding:20px;margin:20px 0}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{font-weight:600;color:#374151}.value{color:#1f2937}.comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}.comment p{margin:8px 0}.action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}</style></head><body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Peer Recognition Rejected</div></div><p>Hello ${submitter.fullName},</p><p>Your peer recognition request was <strong>rejected</strong>.</p><div class="box"><div class="row"><span class="label">Recognized:</span><span class="value">${recognized?.fullName || 'Peer'}</span></div><div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div><div class="row"><span class="label">Reviewed by:</span><span class="value">${admin.fullName} (${admin.email})</span></div><div class="row"><span class="label">Reviewed on:</span><span class="value">${currentDate}</span></div>${safeNote ? `<div class="comment">${safeNote}</div>` : ''}</div><a class="action-button" href="${dashboardUrl}">View Recognitions</a><div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div></div></body></html>`;
}

/**
 * Send INVENTORY REQUEST SUBMISSION email to all admins in the organization
 */
async function sendInventoryRequestSubmissionEmail({ organization, admins, submitter, request }) {
  const maxRetries = 3; let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateInventoryRequestSubmissionEmailHTML({ organization, submitter, request });
      const subject = '📦 New Inventory Request Submitted - StaffBridge';
      const promises = admins.map(async (admin) => {
        const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: admin.email, subject, html };
        const result = await transporter.sendMail(mailOptions);
        return { success: true, email: admin.email, messageId: result.messageId };
      });
      await Promise.all(promises);
      return { success: true };
    } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); }
  }
  throw new Error('Failed to send inventory request submission emails after multiple attempts.');
}

function generateInventoryRequestSubmissionEmailHTML({ organization, submitter, request }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/inventory/requests`;
  const requiredDate = new Date(request.requiredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const safeJustification = request.justification ? cleanHTMLForEmail(request.justification) : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>New Inventory Request - StaffBridge</title><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}.container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}.logo{font-size:2rem;font-weight:700;color:#1C4E80}.subtitle{color:#6B7280}.box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:20px;margin:20px 0}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{font-weight:600;color:#374151}.value{color:#1f2937}.just{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}.just p{margin:8px 0}.action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}</style></head><body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">New Inventory Request</div></div><p>Hello Admin,</p><p>${submitter.fullName} submitted a new inventory request.</p><div class="box"><div class="row"><span class="label">Item:</span><span class="value">${request.itemName}</span></div><div class="row"><span class="label">Category:</span><span class="value">${request.category}</span></div><div class="row"><span class="label">Quantity:</span><span class="value">${request.quantity}</span></div><div class="row"><span class="label">Required Date:</span><span class="value">${requiredDate}</span></div><div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>${safeJustification ? `<div class="just">${safeJustification}</div>` : ''}</div><a class="action-button" href="${dashboardUrl}">Review Requests</a><div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div></div></body></html>`;
}

/**
 * Send INVENTORY REQUEST DECISION email (Approved/Rejected) to submitter
 */
async function sendInventoryRequestDecisionEmail({ organization, submitter, admin, request, status, adminComment }) {
  const maxRetries = 3; let lastError; for (let attempt = 1; attempt <= maxRetries; attempt++) { try { if (!transporter) throw new Error('SMTP transporter not initialized'); const html = generateInventoryRequestDecisionEmailHTML({ organization, submitter, admin, request, status, adminComment }); const subject = `${status === 'Approved' ? '✅' : '❌'} Inventory Request ${status}`; const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: submitter.email, subject, html }; const result = await transporter.sendMail(mailOptions); return { success: true, email: submitter.email, messageId: result.messageId }; } catch (error) { lastError = error; if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000)); } } throw new Error('Failed to send inventory request decision email after multiple attempts.');
}

function generateInventoryRequestDecisionEmailHTML({ organization, submitter, admin, request, status, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/inventory/requests`;
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Inventory Request ${status} - StaffBridge</title><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:${status==='Approved'?'#ecfdf5':'#fef2f2'}}.container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}.logo{font-size:2rem;font-weight:700;color:#1C4E80}.subtitle{color:#6B7280}.box{background:${status==='Approved'?'#ecfdf5':'#fff1f2'};border:1px solid ${status==='Approved'?'#10b981':'#fda4af'};border-radius:8px;padding:20px;margin:20px 0}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{font-weight:600;color:#374151}.value{color:#1f2937}.comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}.comment p{margin:8px 0}.action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}</style></head><body><div class="container"><div class="header"><div class="logo">StaffBridge</div><div class="subtitle">Inventory Request ${status}</div></div><p>Hello ${submitter.fullName},</p><p>Your inventory request has been <strong>${status.toLowerCase()}</strong>.</p><div class="box"><div class="row"><span class="label">Item:</span><span class="value">${request.itemName}</span></div><div class="row"><span class="label">Category:</span><span class="value">${request.category}</span></div><div class="row"><span class="label">Quantity:</span><span class="value">${request.quantity}</span></div><div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div><div class="row"><span class="label">Decision by:</span><span class="value">${admin.fullName} (${admin.email})</span></div><div class="row"><span class="value">Decision on:</span><span class="value">${currentDate}</span></div>${safeComment ? `<div class="comment">${safeComment}</div>` : ''}</div><a class="action-button" href="${dashboardUrl}">View My Requests</a><div class="footer"><p>This is an automated notification from StaffBridge.</p><p>If you have any questions, please contact your system administrator.</p></div></div></body></html>`;
}

/**
 * Send owner message email to organization admins using SMTP
 * @param {Object} params
 * @param {Object} params.organization - Organization details
 * @param {Array} params.admins - Array of admin users in the organization
 * @param {string} params.message - Message content from owner
 * @param {string} params.ownerEmail - Owner's email address
 * @param {string} params.subject - Email subject (optional)
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendOwnerMessageEmail({ organization, admins, message, ownerEmail, subject = 'Message from StaffBridge Support' }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send owner message to organization: ${organization.name} (attempt ${attempt}/${maxRetries})`);
      console.log('Message subject:', subject);
      console.log('Admins to notify:', admins.length);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateOwnerMessageEmailHTML({ organization, message, ownerEmail });
      
      // Send to all admins in the organization
      const promises = admins.map(async (admin) => {
        const mailOptions = {
          from: '"StaffBridge Support" <support@stfbridge.com>',
          to: admin.email,
          subject,
          html,
        };

        console.log(`Sending owner message to admin: ${admin.email}`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Owner message sent successfully to ${admin.email}:`, result.messageId);
        return { success: true, email: admin.email, messageId: result.messageId };
      });

      const results = await Promise.all(promises);
      console.log(`Owner message sent successfully to ${results.length} admins in organization: ${organization.name}`);
      
      return { 
        success: true, 
        messageCount: results.length,
        results 
      };
    } catch (error) {
      lastError = error;
      console.error(`Error sending owner message email (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        message: error.message
      });
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  let errorMessage = 'Failed to send owner message email after multiple attempts';
  if (lastError.code === 'EAUTH') {
    errorMessage = 'SMTP authentication failed. Please check your credentials.';
  } else if (lastError.code === 'ECONNECTION') {
    errorMessage = 'SMTP connection failed. Please check your server settings.';
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage = 'SMTP connection timed out. Please try again.';
  } else if (lastError.response) {
    errorMessage = `SMTP server error: ${lastError.response}`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate HTML content for owner message email
 * @param {Object} params
 * @param {Object} params.organization - Organization details
 * @param {string} params.message - Message content from owner
 * @param {string} params.ownerEmail - Owner's email address
 * @returns {string} - HTML content for the email
 */
function generateOwnerMessageEmailHTML({ organization, message, ownerEmail }) {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/dashboard`;
  const safeMessage = cleanHTMLForEmail(message);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Message from StaffBridge Support</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f7f9fb;
    }
    .container {
      background: #fff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 6px rgba(0,0,0,.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1C4E80;
    }
    .logo {
      font-size: 2rem;
      font-weight: 700;
      color: #1C4E80;
    }
    .subtitle {
      color: #6B7280;
      font-size: 1.1rem;
    }
    .box {
      background: #eff6ff;
      border: 1px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .label {
      font-weight: 600;
      color: #374151;
    }
    .value {
      color: #1f2937;
    }
    .message-content {
      background: #fefefe;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-top: 12px;
      color: #374151;
      white-space: pre-line;
    }
    .message-content p {
      margin: 8px 0;
    }
    .action-button {
      display: inline-block;
      background: #1C4E80;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 16px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6B7280;
      font-size: .9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">Message from Support Team</div>
    </div>
    
    <p>Hello Admin,</p>
    
    <p>You have received an important message from the StaffBridge support team regarding your organization.</p>
    
    <div class="box">
      <div class="row">
        <span class="label">Organization:</span>
        <span class="value">${organization.name}</span>
      </div>
      <div class="row">
        <span class="label">From:</span>
        <span class="value">StaffBridge Support Team</span>
      </div>
      <div class="row">
        <span class="label">Date:</span>
        <span class="value">${currentDate}</span>
      </div>
      
      <div class="message-content">
        ${safeMessage}
      </div>
    </div>
    
    <a class="action-button" href="${dashboardUrl}">Go to Dashboard</a>
    
    <div class="footer">
      <p>This is an official communication from StaffBridge.</p>
      <p>If you have any questions, please contact support at support@stfbridge.com</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send onboarding welcome email to new hire with preboarding portal link
 * @param {Object} params - Email parameters
 * @param {Object} params.organization - Organization details
 * @param {Object} params.newHire - New hire user object
 * @param {Object} params.onboardingPipeline - Onboarding pipeline details
 * @param {string} params.preboardingToken - Token for preboarding portal access
 * @param {Object} params.manager - Manager details (optional)
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendOnboardingWelcomeEmail({ organization, newHire, onboardingPipeline, preboardingToken, manager }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send onboarding welcome email to: ${newHire.email} (attempt ${attempt}/${maxRetries})`);
      console.log('Organization:', organization.name);
      console.log('Position:', onboardingPipeline.position);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateOnboardingWelcomeEmailHTML({ 
        organization, 
        newHire, 
        onboardingPipeline, 
        preboardingToken, 
        manager 
      });
      
      const mailOptions = {
        from: '"StaffBridge HR Team" <hr@stfbridge.com>',
        to: newHire.email,
        subject: `Welcome to ${organization.name} - Your Onboarding Journey Begins! 🎉`,
        html: html,
        // Add reply-to for HR team
        replyTo: organization.email || 'hr@stfbridge.com'
      };

      console.log('Sending onboarding welcome email with options:', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        from: mailOptions.from
      });

      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Onboarding welcome email sent successfully to ${newHire.email}:`, result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: newHire.email,
        attempt: attempt
      };

    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed for onboarding email to ${newHire.email}:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries} attempts failed for onboarding email to ${newHire.email}`);
        throw new Error(`Failed to send onboarding welcome email after ${maxRetries} attempts: ${lastError.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`⏱️ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate HTML content for onboarding welcome email
 * @param {Object} params - Email template parameters
 * @param {Object} params.organization - Organization details
 * @param {Object} params.newHire - New hire user object
 * @param {Object} params.onboardingPipeline - Onboarding pipeline details
 * @param {string} params.preboardingToken - Token for preboarding portal access
 * @param {Object} params.manager - Manager details (optional)
 * @returns {string} - HTML content for the email
 */
function generateOnboardingWelcomeEmailHTML({ organization, newHire, onboardingPipeline, preboardingToken, manager }) {
  const startDate = new Date(onboardingPipeline.startDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  const preboardingUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/preboarding/${preboardingToken}`;
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/dashboard`;
  
  const managerInfo = manager ? `
    <div class="row">
      <span class="label">Your Manager:</span>
      <span class="value">${manager.firstName} ${manager.lastName}</span>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${organization.name}!</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .container {
      background-color: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #007bff;
    }
    .welcome-title {
      color: #007bff;
      font-size: 28px;
      font-weight: bold;
      margin: 0;
      margin-bottom: 10px;
    }
    .organization-name {
      color: #6c757d;
      font-size: 18px;
      margin: 0;
    }
    .greeting {
      font-size: 18px;
      color: #2c3e50;
      margin-bottom: 20px;
    }
    .message-section {
      margin-bottom: 30px;
      line-height: 1.7;
    }
    .box {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #007bff;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0;
      padding: 8px 0;
    }
    .label {
      font-weight: bold;
      color: #495057;
      min-width: 120px;
    }
    .value {
      color: #2c3e50;
      font-weight: 500;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(45deg, #007bff, #0056b3);
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
      box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
      transition: all 0.3s ease;
    }
    .action-button:hover {
      background: linear-gradient(45deg, #0056b3, #004085);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 123, 255, 0.4);
    }
    .highlight-box {
      background: linear-gradient(135deg, #e3f2fd, #bbdefb);
      border: 2px solid #2196f3;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    .next-steps {
      background-color: #e8f5e8;
      border-left: 4px solid #28a745;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .next-steps h3 {
      color: #155724;
      margin-top: 0;
    }
    .next-steps ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .next-steps li {
      margin: 8px 0;
      color: #155724;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      font-size: 14px;
      color: #6c757d;
      text-align: center;
    }
    .footer p {
      margin: 5px 0;
    }
    .emoji {
      font-size: 1.2em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="welcome-title">Welcome to Our Team! <span class="emoji">🎉</span></h1>
      <p class="organization-name">${organization.name}</p>
    </div>
    
    <div class="greeting">
      Dear ${newHire.firstName},
    </div>
    
    <div class="message-section">
      <p>We are thrilled to welcome you to <strong>${organization.name}</strong>! Your journey with us as a <strong>${onboardingPipeline.position}</strong> begins on <strong>${startDate}</strong>, and we couldn't be more excited to have you join our team.</p>
      
      <p>To ensure you have the best possible start, we've prepared a personalized onboarding experience just for you. This will help you get familiar with our company culture, processes, and your new role.</p>
    </div>

    <div class="highlight-box">
      <h3 style="color: #1976d2; margin-top: 0;"><span class="emoji">🚀</span> Your Preboarding Portal is Ready!</h3>
      <p>Click the button below to access your personal preboarding portal where you can:</p>
      <ul style="text-align: left; display: inline-block; margin: 15px 0;">
        <li>Complete essential forms and documents</li>
        <li>Upload required documents</li>
        <li>Review your onboarding schedule</li>
        <li>Get to know your team and manager</li>
      </ul>
    </div>
    
    <div style="text-align: center;">
      <a class="action-button" href="${preboardingUrl}">
        <span class="emoji">🔗</span> Access Your Preboarding Portal
      </a>
    </div>
    
    <div class="box">
      <h3 style="color: #007bff; margin-top: 0;">Your Onboarding Details</h3>
      <div class="row">
        <span class="label">Position:</span>
        <span class="value">${onboardingPipeline.position}</span>
      </div>
      <div class="row">
        <span class="label">Department:</span>
        <span class="value">${onboardingPipeline.department || 'General'}</span>
      </div>
      <div class="row">
        <span class="label">Start Date:</span>
        <span class="value">${startDate}</span>
      </div>
      <div class="row">
        <span class="label">Location:</span>
        <span class="value">${onboardingPipeline.location || 'Office'}</span>
      </div>
      ${managerInfo}
    </div>

    <div class="next-steps">
      <h3><span class="emoji">📋</span> What Happens Next?</h3>
      <ul>
        <li><strong>Complete your preboarding:</strong> Use the link above to fill out forms and upload documents</li>
        <li><strong>Prepare for your first day:</strong> Review the information and schedule in your portal</li>
        <li><strong>Meet your team:</strong> We'll introduce you to your colleagues and manager</li>
        <li><strong>Get settled in:</strong> We'll help you set up your workspace and accounts</li>
      </ul>
    </div>
    
    <div class="message-section">
      <p><strong>Need help?</strong> If you have any questions before your start date, don't hesitate to reach out to our HR team. We're here to make your transition as smooth as possible!</p>
      
      <p>We look forward to working with you and are confident you'll be a valuable addition to our team.</p>
      
      <p style="margin-top: 30px;">
        <strong>Welcome aboard!</strong><br>
        <em>The ${organization.name} Team</em>
      </p>
    </div>
    
    <div class="footer">
      <p><strong>🏢 ${organization.name}</strong></p>
      <p>This email was sent from our onboarding system. Please do not reply directly to this email.</p>
      <p>For support, contact: ${organization.email || 'hr@stfbridge.com'}</p>
      <p><a href="${dashboardUrl}" style="color: #007bff;">Visit StaffBridge Dashboard</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send EVENT REQUEST SUBMISSION email to all admins in the organization
 */
async function sendEventRequestSubmissionEmail({ organization, admins, submitter, event }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateEventRequestSubmissionEmailHTML({ organization, submitter, event });
      const subject = '📅 New Event Request Submitted - StaffBridge';
      const promises = admins.map(async (admin) => {
        const mailOptions = { 
          from: '"Staff Bridge" <support@stfbridge.com>', 
          to: admin.email, 
          subject, 
          html 
        };
        const result = await transporter.sendMail(mailOptions);
        return { success: true, email: admin.email, messageId: result.messageId };
      });
      await Promise.all(promises);
      return { success: true };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send event request submission emails after multiple attempts.');
}

function generateEventRequestSubmissionEmailHTML({ organization, submitter, event }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/events/approvals`;
  const startDate = new Date(event.startsAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const endDate = new Date(event.endsAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const safeDescription = event.description ? cleanHTMLForEmail(event.description) : '';
  const safeNotes = event.notes ? cleanHTMLForEmail(event.notes) : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Event Request - StaffBridge</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f7f9fb; }
    .container { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,.1); }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .logo { font-size: 2rem; font-weight: 700; color: #1C4E80; }
    .subtitle { color: #6B7280; }
    .box { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { font-weight: 600; color: #374151; }
    .value { color: #1f2937; }
    .description { background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 12px; color: #374151; }
    .description p { margin: 8px 0; }
    .requirements { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin-top: 12px; }
    .requirements ul { margin: 8px 0; padding-left: 20px; }
    .action-button { display: inline-block; background: #1C4E80; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6B7280; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">New Event Request</div>
    </div>
    
    <p>Hello Admin,</p>
    <p><strong>${submitter.fullName}</strong> submitted a new event request that requires your approval.</p>
    
    <div class="box">
      <div class="row">
        <span class="label">Event Title:</span>
        <span class="value">${event.title}</span>
      </div>
      <div class="row">
        <span class="label">Type:</span>
        <span class="value">${event.type}</span>
      </div>
      <div class="row">
        <span class="label">Start Date:</span>
        <span class="value">${startDate}</span>
      </div>
      <div class="row">
        <span class="label">End Date:</span>
        <span class="value">${endDate}</span>
      </div>
      <div class="row">
        <span class="label">Location:</span>
        <span class="value">${event.locationId?.name || event.locationText || 'TBD'}</span>
      </div>
      <div class="row">
        <span class="label">Expected Attendees:</span>
        <span class="value">${event.expectedAttendees || 'Not specified'}</span>
      </div>
      <div class="row">
        <span class="label">Organization:</span>
        <span class="value">${organization.name}</span>
      </div>
      
      ${safeDescription ? `<div class="description">${safeDescription}</div>` : ''}
      
      ${event.toggles && (event.toggles.refreshments || event.toggles.equipment || event.toggles.facilities || event.toggles.security || event.toggles.av) ? `
        <div class="requirements">
          <strong>Special Requirements:</strong>
          <ul>
            ${event.toggles.refreshments ? '<li>Refreshments</li>' : ''}
            ${event.toggles.equipment ? '<li>Equipment</li>' : ''}
            ${event.toggles.facilities ? '<li>Facilities</li>' : ''}
            ${event.toggles.security ? '<li>Security</li>' : ''}
            ${event.toggles.av ? '<li>AV Support</li>' : ''}
          </ul>
        </div>
      ` : ''}
      
      ${safeNotes ? `<div class="description">${safeNotes}</div>` : ''}
    </div>
    
    <a class="action-button" href="${dashboardUrl}">Review Event Request</a>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send EVENT APPROVAL email to the submitter
 */
async function sendEventApprovalEmail({ organization, submitter, admin, event, adminComment }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateEventApprovalEmailHTML({ organization, submitter, admin, event, adminComment });
      const subject = '✅ Event Request Approved - StaffBridge';
      const mailOptions = { 
        from: '"Staff Bridge" <support@stfbridge.com>', 
        to: submitter.email, 
        subject, 
        html 
      };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send event approval email after multiple attempts.');
}

function generateEventApprovalEmailHTML({ organization, submitter, admin, event, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/events/my`;
  const startDate = new Date(event.startsAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Event Request Approved - StaffBridge</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #ecfdf5; }
    .container { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,.1); }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .logo { font-size: 2rem; font-weight: 700; color: #1C4E80; }
    .subtitle { color: #6B7280; }
    .box { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { font-weight: 600; color: #374151; }
    .value { color: #1f2937; }
    .comment { background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 12px; color: #374151; }
    .comment p { margin: 8px 0; }
    .action-button { display: inline-block; background: #1C4E80; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6B7280; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">Event Request Approved</div>
    </div>
    
    <p>Hello ${submitter.fullName},</p>
    <p>Great news! Your event request has been <strong>approved</strong>.</p>
    
    <div class="box">
      <div class="row">
        <span class="label">Event Title:</span>
        <span class="value">${event.title}</span>
      </div>
      <div class="row">
        <span class="label">Event Date:</span>
        <span class="value">${startDate}</span>
      </div>
      <div class="row">
        <span class="label">Location:</span>
        <span class="value">${event.locationId?.name || event.locationText || 'TBD'}</span>
      </div>
      <div class="row">
        <span class="label">Organization:</span>
        <span class="value">${organization.name}</span>
      </div>
      <div class="row">
        <span class="label">Approved by:</span>
        <span class="value">${admin.fullName} (${admin.email})</span>
      </div>
      <div class="row">
        <span class="label">Approved on:</span>
        <span class="value">${currentDate}</span>
      </div>
      
      ${safeComment ? `<div class="comment">${safeComment}</div>` : ''}
    </div>
    
    <a class="action-button" href="${dashboardUrl}">View My Events</a>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send EVENT REJECTION email to the submitter
 */
async function sendEventRejectionEmail({ organization, submitter, admin, event, adminComment }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateEventRejectionEmailHTML({ organization, submitter, admin, event, adminComment });
      const subject = '❌ Event Request Rejected - StaffBridge';
      const mailOptions = { 
        from: '"Staff Bridge" <support@stfbridge.com>', 
        to: submitter.email, 
        subject, 
        html 
      };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: submitter.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send event rejection email after multiple attempts.');
}

function generateEventRejectionEmailHTML({ organization, submitter, admin, event, adminComment }) {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/events/my`;
  const startDate = new Date(event.startsAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const safeComment = adminComment ? cleanHTMLForEmail(adminComment) : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Event Request Rejected - StaffBridge</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #fef2f2; }
    .container { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,.1); }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .logo { font-size: 2rem; font-weight: 700; color: #1C4E80; }
    .subtitle { color: #6B7280; }
    .box { background: #fff1f2; border: 1px solid #fda4af; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { font-weight: 600; color: #374151; }
    .value { color: #1f2937; }
    .comment { background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 12px; color: #374151; }
    .comment p { margin: 8px 0; }
    .action-button { display: inline-block; background: #1C4E80; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6B7280; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">Event Request Rejected</div>
    </div>
    
    <p>Hello ${submitter.fullName},</p>
    <p>We regret to inform you that your event request has been <strong>rejected</strong>.</p>
    
    <div class="box">
      <div class="row">
        <span class="label">Event Title:</span>
        <span class="value">${event.title}</span>
      </div>
      <div class="row">
        <span class="label">Requested Date:</span>
        <span class="value">${startDate}</span>
      </div>
      <div class="row">
        <span class="label">Location:</span>
        <span class="value">${event.locationId?.name || event.locationText || 'TBD'}</span>
      </div>
      <div class="row">
        <span class="label">Organization:</span>
        <span class="value">${organization.name}</span>
      </div>
      <div class="row">
        <span class="label">Rejected by:</span>
        <span class="value">${admin.fullName} (${admin.email})</span>
      </div>
      <div class="row">
        <span class="label">Rejected on:</span>
        <span class="value">${currentDate}</span>
      </div>
      
      ${safeComment ? `<div class="comment">${safeComment}</div>` : ''}
    </div>
    
    <a class="action-button" href="${dashboardUrl}">View My Events</a>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
}

// Send ticket assignment email
const sendTicketAssignmentEmail = async ({ ticket, assignee, requester }) => {
  try {
    const subject = `New Helpdesk Ticket Assigned: ${ticket.title}`;
    const html = generateTicketAssignmentEmailHTML({ ticket, assignee, requester });
    
    console.log(`Attempting to send ticket assignment email to: ${assignee.email}`);
    console.log(`Email subject: ${subject}`);
    console.log(`From: "Staff Bridge" <support@stfbridge.com>`);
    
    const result = await transporter.sendMail({
      from: '"Staff Bridge" <support@stfbridge.com>',
      to: assignee.email,
      subject: subject,
      html: html
    });
    
    console.log(`Ticket assignment email sent successfully to ${assignee.email}`);
    console.log(`Message ID: ${result.messageId}`);
  } catch (error) {
    console.error('Error sending ticket assignment email:', error);
    console.error('Error details:', {
      to: assignee.email,
      subject: `New Helpdesk Ticket Assigned: ${ticket.title}`,
      error: error.message,
      code: error.code
    });
    throw error;
  }
};

// Send ticket status change email to requester
const sendTicketStatusChangeEmail = async ({ ticket, requester, changedBy, oldStatus, newStatus }) => {
  try {
    const subject = `Ticket Status Updated: ${ticket.title}`;
    const html = generateTicketStatusChangeEmailHTML({ ticket, requester, changedBy, oldStatus, newStatus });
    
    await transporter.sendMail({
      from: '"Staff Bridge" <support@stfbridge.com>',
      to: requester.email,
      subject: subject,
      html: html
    });
    
    console.log(`Ticket status change email sent to ${requester.email}`);
  } catch (error) {
    console.error('Error sending ticket status change email:', error);
    throw error;
  }
};

// Send ticket creation notification email to assigned team
const sendTicketCreationEmail = async ({ ticket, requester, assignedUsers }) => {
  try {
    const subject = `New Helpdesk Ticket Created: ${ticket.title}`;
    
    console.log(`Attempting to send ticket creation emails to ${assignedUsers.length} users`);
    
    // Send to all assigned users
    for (const user of assignedUsers) {
      const html = generateTicketCreationEmailHTML({ ticket, requester, assignedUser: user });
      
      console.log(`Sending creation email to: ${user.email}`);
      
      const result = await transporter.sendMail({
        from: '"Staff Bridge" <support@stfbridge.com>',
        to: user.email,
        subject: subject,
        html: html
      });
      
      console.log(`Ticket creation email sent successfully to ${user.email}`);
      console.log(`Message ID: ${result.messageId}`);
    }
  } catch (error) {
    console.error('Error sending ticket creation email:', error);
    console.error('Error details:', {
      assignedUsers: assignedUsers.map(u => u.email),
      subject: `New Helpdesk Ticket Created: ${ticket.title}`,
      error: error.message,
      code: error.code
    });
    throw error;
  }
};

// Generate ticket assignment email HTML
const generateTicketAssignmentEmailHTML = ({ ticket, assignee, requester }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/helpdesk/tickets/${ticket._id}`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Helpdesk Ticket Assigned</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .ticket-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .row { display: flex; margin-bottom: 10px; }
    .label { font-weight: bold; min-width: 120px; color: #1C4E80; }
    .value { flex: 1; }
    .priority { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .priority-urgent { background: #fee2e2; color: #dc2626; }
    .priority-high { background: #fef3c7; color: #d97706; }
    .priority-medium { background: #dbeafe; color: #2563eb; }
    .priority-low { background: #d1fae5; color: #059669; }
    .action-button { display: inline-block; background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Helpdesk Ticket Assigned</h1>
    </div>
    
    <div class="content">
      <p>Hello ${assignee.fullName},</p>
      
      <p>A new helpdesk ticket has been assigned to you:</p>
      
      <div class="ticket-info">
        <div class="row">
          <span class="label">Ticket #:</span>
          <span class="value">${ticket.ticketNumber}</span>
        </div>
        <div class="row">
          <span class="label">Title:</span>
          <span class="value">${ticket.title}</span>
        </div>
        <div class="row">
          <span class="label">Priority:</span>
          <span class="value">
            <span class="priority priority-${ticket.priority}">${ticket.priority}</span>
          </span>
        </div>
        <div class="row">
          <span class="label">Category:</span>
          <span class="value">${ticket.category?.name || 'General'}</span>
        </div>
        <div class="row">
          <span class="label">Requested by:</span>
          <span class="value">${requester.fullName} (${requester.email})</span>
        </div>
        <div class="row">
          <span class="label">Created:</span>
          <span class="value">${currentDate}</span>
        </div>
        <div class="row">
          <span class="label">Description:</span>
          <span class="value">${ticket.description}</span>
        </div>
      </div>
      
      <a class="action-button" href="${dashboardUrl}">View Ticket Details</a>
      
      <p>Please review the ticket and take appropriate action as soon as possible.</p>
    </div>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
};

// Generate ticket status change email HTML
const generateTicketStatusChangeEmailHTML = ({ ticket, requester, changedBy, oldStatus, newStatus }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/helpdesk/my-requests`;
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#dc2626';
      case 'in_progress': return '#d97706';
      case 'on_hold': return '#6b7280';
      case 'resolved': return '#059669';
      case 'closed': return '#374151';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'on_hold': return 'On Hold';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  };
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Status Updated</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .ticket-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .row { display: flex; margin-bottom: 10px; }
    .label { font-weight: bold; min-width: 120px; color: #1C4E80; }
    .value { flex: 1; }
    .status-change { background: #e0f2fe; border-left: 4px solid #0288d1; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .action-button { display: inline-block; background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ticket Status Updated</h1>
    </div>
    
    <div class="content">
      <p>Hello ${requester.fullName},</p>
      
      <p>The status of your helpdesk ticket has been updated:</p>
      
      <div class="ticket-info">
        <div class="row">
          <span class="label">Ticket #:</span>
          <span class="value">${ticket.ticketNumber}</span>
        </div>
        <div class="row">
          <span class="label">Title:</span>
          <span class="value">${ticket.title}</span>
        </div>
        <div class="row">
          <span class="label">Category:</span>
          <span class="value">${ticket.category?.name || 'General'}</span>
        </div>
        <div class="row">
          <span class="label">Updated by:</span>
          <span class="value">${changedBy.fullName}</span>
        </div>
        <div class="row">
          <span class="label">Updated:</span>
          <span class="value">${currentDate}</span>
        </div>
      </div>
      
      <div class="status-change">
        <strong>Status Change:</strong><br>
        <span class="status-badge" style="background: ${getStatusColor(oldStatus)}; color: white;">${getStatusLabel(oldStatus)}</span>
        <span style="margin: 0 10px;">→</span>
        <span class="status-badge" style="background: ${getStatusColor(newStatus)}; color: white;">${getStatusLabel(newStatus)}</span>
      </div>
      
      <a class="action-button" href="${dashboardUrl}">View My Tickets</a>
      
      <p>Thank you for using our helpdesk system.</p>
    </div>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
};

// Generate ticket creation email HTML
const generateTicketCreationEmailHTML = ({ ticket, requester, assignedUser }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/helpdesk/tickets/${ticket._id}`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Helpdesk Ticket Created</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .ticket-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .row { display: flex; margin-bottom: 10px; }
    .label { font-weight: bold; min-width: 120px; color: #1C4E80; }
    .value { flex: 1; }
    .priority { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .priority-urgent { background: #fee2e2; color: #dc2626; }
    .priority-high { background: #fef3c7; color: #d97706; }
    .priority-medium { background: #dbeafe; color: #2563eb; }
    .priority-low { background: #d1fae5; color: #059669; }
    .action-button { display: inline-block; background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Helpdesk Ticket Created</h1>
    </div>
    
    <div class="content">
      <p>Hello ${assignedUser.fullName},</p>
      
      <p>A new helpdesk ticket has been created in your assigned category:</p>
      
      <div class="ticket-info">
        <div class="row">
          <span class="label">Ticket #:</span>
          <span class="value">${ticket.ticketNumber}</span>
        </div>
        <div class="row">
          <span class="label">Title:</span>
          <span class="value">${ticket.title}</span>
        </div>
        <div class="row">
          <span class="label">Priority:</span>
          <span class="value">
            <span class="priority priority-${ticket.priority}">${ticket.priority}</span>
          </span>
        </div>
        <div class="row">
          <span class="label">Category:</span>
          <span class="value">${ticket.category?.name || 'General'}</span>
        </div>
        <div class="row">
          <span class="label">Requested by:</span>
          <span class="value">${requester.fullName} (${requester.email})</span>
        </div>
        <div class="row">
          <span class="label">Created:</span>
          <span class="value">${currentDate}</span>
        </div>
        <div class="row">
          <span class="label">Description:</span>
          <span class="value">${ticket.description}</span>
        </div>
      </div>
      
      <a class="action-button" href="${dashboardUrl}">View Ticket Details</a>
      
      <p>Please review the ticket and take appropriate action as soon as possible.</p>
    </div>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send contact sales email notification to support team using SMTP
 * @param {Object} params
 * @param {string} params.name - Contact's full name
 * @param {string} params.workEmail - Contact's work email
 * @param {string} params.company - Company name
 * @param {string} params.teamSize - Team size
 * @param {string} params.country - Country/region
 * @param {Array} params.modulesOfInterest - Array of modules they're interested in
 * @param {string} params.message - Additional message
 * @param {string} params.plan - Plan type (Custom, etc.)
 * @param {string} params.submittedAt - Submission timestamp
 * @returns {Promise<Object>} - Result of the email sending operation
 */
async function sendContactSalesEmail({
  name,
  workEmail,
  company,
  teamSize,
  country,
  modulesOfInterest,
  message,
  plan,
  submittedAt
}) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to send contact sales email (attempt ${attempt}/${maxRetries})`);
      
      // Check if transporter is ready
      if (!transporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      const html = generateContactSalesEmailHTML({
        name,
        workEmail,
        company,
        teamSize,
        country,
        modulesOfInterest,
        message,
        plan,
        submittedAt
      });
      
      const subject = `🚀 New Contact Sales Request - ${company} (${plan} Plan)`;
      
      const mailOptions = {
        from: '"Staff Bridge" <support@stfbridge.com>',
        to: 'support@stfbridge.com',
        subject,
        html,
        replyTo: workEmail
      };

      console.log(`Sending contact sales email to support@stfbridge.com for ${company}`);
      const result = await transporter.sendMail(mailOptions);
      console.log(`Contact sales email sent successfully:`, result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        attempt
      };

    } catch (error) {
      lastError = error;
      console.error(`Contact sales email attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('All contact sales email attempts failed:', lastError);
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate HTML content for contact sales email
 */
function generateContactSalesEmailHTML({
  name,
  workEmail,
  company,
  teamSize,
  country,
  modulesOfInterest,
  message,
  plan,
  submittedAt
}) {
  const currentDate = new Date(submittedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Sales Request</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fb;
        }
        .container {
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1C4E80;
          margin-bottom: 20px;
        }
        .contact-box {
          background-color: #f8f9fa;
          border-left: 4px solid #EA6A47;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .contact-title {
          font-size: 18px;
          font-weight: bold;
          color: #1C4E80;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
        }
        .contact-details {
          margin-bottom: 15px;
        }
        .detail-row {
          display: flex;
          margin-bottom: 8px;
          align-items: flex-start;
        }
        .detail-label {
          font-weight: 600;
          color: #1C4E80;
          min-width: 120px;
          margin-right: 10px;
        }
        .detail-value {
          color: #333;
          flex: 1;
        }
        .modules-list {
          background-color: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 15px;
          margin-top: 10px;
        }
        .module-item {
          padding: 4px 0;
          color: #495057;
        }
        .message-box {
          background-color: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 15px;
          margin-top: 15px;
        }
        .message-label {
          font-weight: 600;
          color: #1C4E80;
          margin-bottom: 8px;
        }
        .message-text {
          color: #495057;
          font-style: italic;
          line-height: 1.5;
        }
        .plan-badge {
          display: inline-block;
          background: linear-gradient(135deg, #1C4E80, #EA6A47);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin-left: 10px;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          margin: 5px 0;
          font-size: 14px;
          color: #6c757d;
        }
        .highlight {
          background-color: #fff3cd;
          padding: 2px 6px;
          border-radius: 4px;
          color: #856404;
          font-weight: 600;
        }
        .priority-high {
          color: #dc3545;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StaffBridge</div>
          <div class="subtitle">New Contact Sales Request</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            👋 New Sales Inquiry Received
          </div>
          
          <p>A potential customer has submitted a contact sales request through the pricing page.</p>
          
          <div class="contact-box">
            <div class="contact-title">
              🎯 ${plan} Plan Inquiry
              <span class="plan-badge">${plan}</span>
            </div>
            
            <div class="contact-details">
              <div class="detail-row">
                <span class="detail-label">Contact Name:</span>
                <span class="detail-value">${name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Work Email:</span>
                <span class="detail-value">${workEmail}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Company:</span>
                <span class="detail-value">${company}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Team Size:</span>
                <span class="detail-value">${teamSize}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Country/Region:</span>
                <span class="detail-value">${country}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Submitted:</span>
                <span class="detail-value">${currentDate}</span>
              </div>
            </div>
            
            ${modulesOfInterest && modulesOfInterest.length > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Modules of Interest:</span>
                <div class="detail-value">
                  <div class="modules-list">
                    ${modulesOfInterest.map(module => `<div class="module-item">• ${module}</div>`).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
            
            ${message ? `
              <div class="message-box">
                <div class="message-label">Additional Message:</div>
                <div class="message-text">"${message}"</div>
              </div>
            ` : ''}
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Review the customer's requirements and team size</li>
            <li>Prepare a customized proposal based on their modules of interest</li>
            <li>Reach out within 1 business day as promised</li>
            <li>Consider scheduling a demo if appropriate</li>
          </ul>
          
          <p><strong>Note:</strong> This lead came from the <span class="highlight">${plan} Plan</span> section of our pricing page, indicating they're interested in a tailored solution.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from the StaffBridge pricing page.</p>
          <p>Reply directly to this email to respond to the customer.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send ticket comment email to requester or assignee
 */
const sendTicketCommentEmail = async ({ ticket, comment, recipient, commenter }) => {
  try {
    const subject = `New Comment on Ticket: ${ticket.title}`;
    const html = generateTicketCommentEmailHTML({ ticket, comment, recipient, commenter });
    
    await transporter.sendMail({
      from: '"Staff Bridge" <support@stfbridge.com>',
      to: recipient.email,
      subject: subject,
      html: html
    });
    
    console.log(`Ticket comment email sent to ${recipient.email}`);
  } catch (error) {
    console.error('Error sending ticket comment email:', error);
    throw error;
  }
};

// Generate ticket comment email HTML
const generateTicketCommentEmailHTML = ({ ticket, comment, recipient, commenter }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/helpdesk/tickets/${ticket._id}`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Comment on Ticket</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .ticket-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .comment-box { background: #fff; border-left: 4px solid #1C4E80; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .comment-author { font-weight: bold; color: #1C4E80; margin-bottom: 10px; }
    .comment-content { color: #333; white-space: pre-wrap; }
    .action-button { display: inline-block; background: linear-gradient(135deg, #1C4E80 0%, #EA6A47 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Comment on Ticket</h1>
    </div>
    
    <div class="content">
      <p>Hello ${recipient.fullName},</p>
      
      <p>A new comment has been added to ticket <strong>${ticket.ticketNumber}</strong>:</p>
      
      <div class="ticket-info">
        <p><strong>Ticket:</strong> ${ticket.title}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
      </div>
      
      <div class="comment-box">
        <div class="comment-author">${commenter.fullName} commented:</div>
        <div class="comment-content">${comment.content}</div>
        <div style="margin-top: 10px; color: #666; font-size: 12px;">${currentDate}</div>
      </div>
      
      <a class="action-button" href="${dashboardUrl}">View Ticket & Respond</a>
    </div>
    
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send performance evaluation notification email to staff member
 */
async function sendPerformanceEvaluationEmail({ organization, staff, admin, evaluation }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generatePerformanceEvaluationEmailHTML({ organization, staff, admin, evaluation });
      const subject = `📊 New Performance Evaluation - StaffBridge`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: staff.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: staff.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send performance evaluation email after multiple attempts.');
}

function generatePerformanceEvaluationEmailHTML({ organization, staff, admin, evaluation }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-evaluations?id=${evaluation._id}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Performance Evaluation - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}
    .value{color:#1f2937}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">New Performance Evaluation</div>
    </div>
    <p>Hello ${staff.fullName},</p>
    <p>A new performance evaluation has been created for you.</p>
    <div class="box">
      <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
      <div class="row"><span class="label">Created by:</span><span class="value">${admin.fullName}</span></div>
      <div class="row"><span class="label">Created on:</span><span class="value">${currentDate}</span></div>
      <div class="row"><span class="label">Goals:</span><span class="value">${evaluation.goals?.length || 0} SMART goals assigned</span></div>
    </div>
    <a class="action-button" href="${dashboardUrl}">View Evaluation</a>
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send letter request submission email to admins
 */
async function sendLetterRequestSubmissionEmail({ organization, admins, submitter, request }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateLetterRequestSubmissionEmailHTML({ organization, submitter, request });
      const subject = `📝 New Letter Request: ${request.requestNumber}`;
      const results = { success: [], failed: [] };
      
      for (const admin of admins) {
        try {
          const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: admin.email, subject, html };
          const result = await transporter.sendMail(mailOptions);
          results.success.push(admin.email);
        } catch (err) {
          results.failed.push(admin.email);
        }
      }
      
      return results;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send letter request submission emails after multiple attempts.');
}

function generateLetterRequestSubmissionEmailHTML({ organization, submitter, request }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/official-letters`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Letter Request - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#fff7ed;border:1px solid #f59e0b;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}
    .value{color:#1f2937}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">New Letter Request</div>
    </div>
    <p>Hello Admin,</p>
    <p><strong>${submitter.fullName}</strong> has submitted a new letter request.</p>
    <div class="box">
      <div class="row"><span class="label">Request #:</span><span class="value">${request.requestNumber}</span></div>
      <div class="row"><span class="label">Template:</span><span class="value">${request.template?.name || 'N/A'}</span></div>
      <div class="row"><span class="label">Submitted by:</span><span class="value">${submitter.fullName} (${submitter.email})</span></div>
      <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
      <div class="row"><span class="label">Submitted on:</span><span class="value">${currentDate}</span></div>
    </div>
    <a class="action-button" href="${dashboardUrl}">Review Request</a>
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send letter request approval/rejection email to staff
 */
async function sendLetterRequestDecisionEmail({ organization, staff, admin, request, status, rejectionReason }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateLetterRequestDecisionEmailHTML({ organization, staff, admin, request, status, rejectionReason });
      const subject = status === 'approved' ? `✅ Letter Request Approved - ${request.requestNumber}` : `❌ Letter Request Rejected - ${request.requestNumber}`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: staff.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: staff.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send letter request decision email after multiple attempts.');
}

function generateLetterRequestDecisionEmailHTML({ organization, staff, admin, request, status, rejectionReason }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/official-letters`;
  const isApproved = status === 'approved';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Letter Request ${isApproved ? 'Approved' : 'Rejected'} - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:${isApproved ? '#f7f9fb' : '#fef2f2'}}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${isApproved ? '#e5e7eb' : '#fee2e2'}}
    .logo{font-size:2rem;font-weight:700;color:${isApproved ? '#1C4E80' : '#b91c1c'}}
    .subtitle{color:${isApproved ? '#6B7280' : '#b91c1c'}}
    .box{background:${isApproved ? '#ecfdf5' : '#fff1f2'};border:1px solid ${isApproved ? '#10b981' : '#fda4af'};border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}
    .value{color:#1f2937}
    .comment{background:#fefefe;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;color:#374151}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">Letter Request ${isApproved ? 'Approved' : 'Rejected'}</div>
    </div>
    <p>Hello ${staff.fullName},</p>
    <p>Your letter request has been <strong>${isApproved ? 'approved' : 'rejected'}</strong>.</p>
    <div class="box">
      <div class="row"><span class="label">Request #:</span><span class="value">${request.requestNumber}</span></div>
      <div class="row"><span class="label">Template:</span><span class="value">${request.template?.name || 'N/A'}</span></div>
      <div class="row"><span class="label">${isApproved ? 'Approved' : 'Reviewed'} by:</span><span class="value">${admin.fullName}</span></div>
      <div class="row"><span class="label">Date:</span><span class="value">${currentDate}</span></div>
      ${!isApproved && rejectionReason ? `<div class="comment"><strong>Rejection Reason:</strong><br/>${rejectionReason}</div>` : ''}
    </div>
    <a class="action-button" href="${dashboardUrl}">View My Letters</a>
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send inventory assignment email to staff member
 */
async function sendInventoryAssignmentEmail({ organization, staff, admin, item }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generateInventoryAssignmentEmailHTML({ organization, staff, admin, item });
      const subject = `📦 Inventory Item Assigned: ${item.name}`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: staff.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: staff.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send inventory assignment email after multiple attempts.');
}

function generateInventoryAssignmentEmailHTML({ organization, staff, admin, item }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-inventory/${item._id}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Inventory Item Assigned - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}
    .value{color:#1f2937}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">Inventory Item Assigned</div>
    </div>
    <p>Hello ${staff.fullName},</p>
    <p>You have been assigned a new inventory item.</p>
    <div class="box">
      <div class="row"><span class="label">Item Name:</span><span class="value">${item.name}</span></div>
      <div class="row"><span class="label">Category:</span><span class="value">${item.category || 'N/A'}</span></div>
      <div class="row"><span class="label">Assigned by:</span><span class="value">${admin.fullName}</span></div>
      <div class="row"><span class="label">Assigned on:</span><span class="value">${currentDate}</span></div>
    </div>
    <a class="action-button" href="${dashboardUrl}">View Item Details</a>
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send performance evaluation update email
 */
async function sendPerformanceEvaluationUpdateEmail({ organization, recipient, updater, evaluation, updateType, changes }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generatePerformanceEvaluationUpdateEmailHTML({ organization, recipient, updater, evaluation, updateType, changes });
      const subject = `📊 Performance Evaluation Updated - StaffBridge`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: recipient.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: recipient.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send performance evaluation update email after multiple attempts.');
}

function generatePerformanceEvaluationUpdateEmailHTML({ organization, recipient, updater, evaluation, updateType, changes }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isStaffRecipient = recipient.role === 'staff' || !recipient.role; // Assume staff if no role field
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}${isStaffRecipient ? '/my-evaluations' : '/admin/performance-evaluations'}?id=${evaluation._id || evaluation}`;
  const changesText = Array.isArray(changes) ? changes.join(', ') : changes || 'information';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Performance Evaluation Updated - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:20px;margin:20px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}
    .value{color:#1f2937}
    .changes{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0}
    .changes-title{font-weight:600;color:#92400e;margin-bottom:8px}
    .changes-list{color:#78350f}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">Performance Evaluation Updated</div>
    </div>
    <p>Hello ${recipient.fullName},</p>
    <p><strong>${updater.fullName}</strong> has updated the performance evaluation.</p>
    <div class="box">
      <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
      <div class="row"><span class="label">Updated by:</span><span class="value">${updater.fullName}</span></div>
      <div class="row"><span class="label">Updated on:</span><span class="value">${currentDate}</span></div>
      <div class="changes">
        <div class="changes-title">What Changed:</div>
        <div class="changes-list">${changesText}</div>
      </div>
    </div>
    <a class="action-button" href="${dashboardUrl}">View Evaluation</a>
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send performance evaluation comment email
 */
async function sendPerformanceEvaluationCommentEmail({ organization, recipient, commenter, evaluation, comment, goalIndex }) {
  const maxRetries = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!transporter) throw new Error('SMTP transporter not initialized');
      const html = generatePerformanceEvaluationCommentEmailHTML({ organization, recipient, commenter, evaluation, comment, goalIndex });
      const subject = `💬 New Comment on Performance Evaluation - StaffBridge`;
      const mailOptions = { from: '"Staff Bridge" <support@stfbridge.com>', to: recipient.email, subject, html };
      const result = await transporter.sendMail(mailOptions);
      return { success: true, email: recipient.email, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('Failed to send performance evaluation comment email after multiple attempts.');
}

function generatePerformanceEvaluationCommentEmailHTML({ organization, recipient, commenter, evaluation, comment, goalIndex }) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isStaffRecipient = recipient.role === 'staff' || !recipient.role;
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}${isStaffRecipient ? '/my-evaluations' : '/admin/performance-evaluations'}?id=${evaluation._id || evaluation}`;
  const goalContext = typeof goalIndex === 'number' ? ` (on Goal ${goalIndex + 1})` : '';
  const commentText = typeof comment === 'string' ? comment : comment?.text || comment?.comment || 'New comment added';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Comment on Performance Evaluation - StaffBridge</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fb}
    .container{background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
    .logo{font-size:2rem;font-weight:700;color:#1C4E80}
    .subtitle{color:#6B7280}
    .box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:20px;margin:20px 0}
    .comment-box{background:#fff;border-left:4px solid #1C4E80;border-radius:8px;padding:16px;margin:16px 0}
    .comment-author{font-weight:600;color:#1C4E80;margin-bottom:8px}
    .comment-content{color:#333;white-space:pre-wrap;line-height:1.6}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    .label{font-weight:600;color:#374151}
    .value{color:#1f2937}
    .action-button{display:inline-block;background:#1C4E80;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6B7280;font-size:.9rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">StaffBridge</div>
      <div class="subtitle">New Comment on Performance Evaluation</div>
    </div>
    <p>Hello ${recipient.fullName},</p>
    <p><strong>${commenter.fullName}</strong> added a new comment${goalContext} to the performance evaluation.</p>
    <div class="box">
      <div class="row"><span class="label">Organization:</span><span class="value">${organization.name}</span></div>
      <div class="row"><span class="label">Commented by:</span><span class="value">${commenter.fullName}</span></div>
      <div class="row"><span class="label">Date:</span><span class="value">${currentDate}</span></div>
    </div>
    <div class="comment-box">
      <div class="comment-author">${commenter.fullName} commented:</div>
      <div class="comment-content">${commentText}</div>
    </div>
    <a class="action-button" href="${dashboardUrl}">View Evaluation & Respond</a>
    <div class="footer">
      <p>This is an automated notification from StaffBridge.</p>
      <p>If you have any questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  sendAbsentStaffEmail,
  sendAbsenceNotificationEmail,
  generateAbsenceEmailHTML,
  sendForgotPasswordEmail,
  generateForgotPasswordEmailHTML,
  sendWelcomeEmail,
  generateWelcomeEmailHTML,
  sendPaymentConfirmationEmail,
  generatePaymentConfirmationEmailHTML,
  sendPeerRecognitionEmail,
  generatePeerRecognitionEmailHTML,
  sendExpenseClaimEmail,
  generateExpenseClaimEmailHTML,
  sendLeaveRequestEmail,
  generateLeaveRequestEmailHTML,
  sendTrainingRequestEmail,
  generateTrainingRequestEmailHTML,
  sendProfileCompletionEmail,
  sendTicketAssignmentEmail,
  sendTicketStatusChangeEmail,
  sendTicketCreationEmail,
  generateTicketStatusChangeEmailHTML,
  generateTicketCreationEmailHTML,
  generateProfileCompletionEmailHTML,
  sendBankDetailsEmail,
  generateBankDetailsEmailHTML,
  sendTaskStatusChangeEmail,
  generateTaskStatusChangeEmailHTML,
  sendBulletinPostEmail,
  generateBulletinPostEmailHTML,
  sendCalendarEventEmail,
  generateCalendarEventEmailHTML,
  cleanHTMLForEmail,
  sendPeerRecognitionApprovalEmail,
  generatePeerRecognitionApprovalEmailHTML,
  sendExpenseClaimApprovalEmail,
  generateExpenseClaimApprovalEmailHTML,
  sendLeaveApprovalEmail,
  generateLeaveApprovalEmailHTML,
  sendTrainingRequestApprovalEmail,
  generateTrainingRequestApprovalEmailHTML,
  sendNewTaskAssignedEmail,
  generateNewTaskAssignedEmailHTML,
  sendExpenseClaimRejectionEmail,
  generateExpenseClaimRejectionEmailHTML,
  sendTrainingRequestRejectionEmail,
  generateTrainingRequestRejectionEmailHTML,
  sendLeaveRejectionEmail,
  generateLeaveRejectionEmailHTML,
  sendPeerRecognitionRejectionEmail,
  generatePeerRecognitionRejectionEmailHTML,
  sendInventoryRequestSubmissionEmail,
  generateInventoryRequestSubmissionEmailHTML,
  sendInventoryRequestDecisionEmail,
  generateInventoryRequestDecisionEmailHTML,
  sendOwnerMessageEmail,
  generateOwnerMessageEmailHTML,
  sendOnboardingWelcomeEmail,
  generateOnboardingWelcomeEmailHTML,
  sendEventRequestSubmissionEmail,
  generateEventRequestSubmissionEmailHTML,
  sendEventApprovalEmail,
  generateEventApprovalEmailHTML,
  sendEventRejectionEmail,
  generateEventRejectionEmailHTML,
  sendContactSalesEmail,
  generateContactSalesEmailHTML,
  sendTicketCommentEmail,
  generateTicketCommentEmailHTML,
  sendPerformanceEvaluationEmail,
  generatePerformanceEvaluationEmailHTML,
  sendLetterRequestSubmissionEmail,
  generateLetterRequestSubmissionEmailHTML,
  sendLetterRequestDecisionEmail,
  generateLetterRequestDecisionEmailHTML,
  sendInventoryAssignmentEmail,
  generateInventoryAssignmentEmailHTML,
  sendPerformanceEvaluationUpdateEmail,
  generatePerformanceEvaluationUpdateEmailHTML,
  sendPerformanceEvaluationCommentEmail,
  generatePerformanceEvaluationCommentEmailHTML,
}; 