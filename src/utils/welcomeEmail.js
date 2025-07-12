const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const STAFF_BRIDGE_LOGO_URL = 'https://backend-y16q.onrender.com/images/staffbridge-logo.png';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'ssalman55@gmail.com';
const COMPANY_NAME = 'Staff Bridge';
const CONTACT_US_URL = 'https://staffbridge.com/contact'; // Replace with actual contact form URL
const PAYMENT_URL_BASE = 'https://staffbridge.com/payment'; // Replace with actual payment link base

function getTrialCountdown(trialEndDate) {
  const now = new Date();
  const end = new Date(trialEndDate);
  const diff = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  return diff;
}

function getPlanLabel(plan) {
  if (plan === 'basic') return 'Free Trial';
  if (plan === 'professional') return 'Professional (Monthly)';
  if (plan === 'enterprise') return 'Enterprise (Annual)';
  return plan;
}

async function sendWelcomeEmail({ organization, admin, plan, trialStartDate, trialEndDate }) {
  const trialDaysLeft = getTrialCountdown(trialEndDate);
  const planLabel = getPlanLabel(plan);
  const isTrial = organization.subscriptionStatus === 'trial';
  const paymentUrl = `${PAYMENT_URL_BASE}?org=${organization._id}`;

  const html = `
    <div style="max-width:600px;margin:auto;font-family:sans-serif;background:#f7f9fb;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${STAFF_BRIDGE_LOGO_URL}" alt="Staff Bridge Logo" style="height:48px;margin-bottom:8px;" />
        <h1 style="color:#1C4E80;font-size:2rem;margin:0;">🎉 Welcome to Staff Bridge – Your Account is Ready!</h1>
      </div>
      <p style="font-size:1.1rem;">Hi <b>${admin.fullName}</b>,</p>
      <p>We're thrilled to welcome <b>${organization.name}</b> to Staff Bridge!</p>
      <div style="background:#fff;border-radius:8px;padding:20px 24px;margin:24px 0 16px 0;box-shadow:0 2px 8px #0001;">
        <p><b>Subscription Type:</b> ${planLabel}</p>
        ${isTrial ? `<p><b>Trial Period:</b> ${trialDaysLeft} days remaining</p>` : ''}
      </div>
      <a href="${paymentUrl}" style="display:inline-block;background:#EA6A47;color:#fff;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:1.1rem;margin-bottom:16px;">Complete Your Payment</a>
      <br/>
      <a href="${CONTACT_US_URL}" style="display:inline-block;margin-top:12px;color:#1C4E80;text-decoration:underline;font-size:1rem;">Contact Us</a>
      <div style="margin:32px 0 16px 0;">
        <h2 style="color:#1C4E80;font-size:1.2rem;margin-bottom:8px;">What's included in your plan?</h2>
        <ul style="padding-left:20px;font-size:1rem;">
          <li>All-in-one staff management dashboard</li>
          <li>Attendance, payroll, and document management</li>
          <li>Performance tracking and peer recognition</li>
          <li>Secure cloud storage</li>
          <li>Priority support</li>
        </ul>
      </div>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
        <b>Getting Started:</b>
        <ul style="padding-left:20px;font-size:1rem;">
          <li><a href="https://staffbridge.com/getting-started" style="color:#1C4E80;">Getting Started Guide</a></li>
          <li><a href="https://staffbridge.com/help" style="color:#1C4E80;">Help Center</a></li>
        </ul>
        ${isTrial ? `<p style="color:#EA6A47;font-weight:bold;">You have ${trialDaysLeft} days remaining in your free trial.</p>` : ''}
      </div>
      <p style="margin-top:24px;font-size:1.1rem;">We're excited to have you onboard!<br/>– The Staff Bridge Team</p>
      <hr style="margin:32px 0 16px 0;border:none;border-top:1px solid #e5e7eb;"/>
      <footer style="font-size:0.95rem;color:#888;text-align:center;">
        <p>Sent by ${COMPANY_NAME} | 123 Main St, City, Country</p>
        <p>Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#1C4E80;">Contact Support</a></p>
        <p><a href="https://staffbridge.com/unsubscribe?email=${encodeURIComponent(admin.email)}" style="color:#EA6A47;">Unsubscribe</a></p>
      </footer>
    </div>
  `;

  const msg = {
    to: admin.email,
    from: {
      email: SUPPORT_EMAIL,
      name: COMPANY_NAME
    },
    subject: '🎉 Welcome to Staff Bridge – Your Account is Ready!',
    html
  };

  try {
    const response = await sgMail.send(msg);
    // Log delivery status (for auditing)
    console.log('Welcome email sent:', response[0]?.statusCode, response[0]?.headers);
    // Optionally, store in DB or monitoring system
    return true;
  } catch (err) {
    // Log error for auditing
    console.error('Error sending welcome email:', err);
    throw err;
  }
}

/**
 * Send absence notification emails using SendGrid Dynamic Template
 * @param {Array<{email: string, name: string, reason?: string}>} users - List of users to notify
 * @param {string} date - Absence date (ISO string or formatted)
 * @param {string} [reason] - Absence reason (optional, can be per user)
 * @returns {Promise<{success: string[], failed: string[]}>}
 */
async function sendAbsenceNotificationEmail(users, date, reason) {
  const templateId = 'd-f6891d9a021944058f0927da618c36d5';
  const uniqueUsers = Array.from(new Map(users.map(u => [u.email, u])).values());
  const results = { success: [], failed: [] };

  for (const user of uniqueUsers) {
    const msg = {
      to: user.email,
      from: {
        email: SUPPORT_EMAIL,
        name: COMPANY_NAME
      },
      templateId,
      dynamicTemplateData: {
        user_name: user.name,
        absence_date: date,
        absence_reason: user.reason || reason || '',
        // Add more fields as required by the template
      }
    };
    try {
      await sgMail.send(msg);
      results.success.push(user.email);
    } catch (err) {
      console.error('Error sending absence notification to', user.email, err);
      results.failed.push(user.email);
    }
  }
  return results;
}

module.exports = { sendWelcomeEmail, sendAbsenceNotificationEmail }; 