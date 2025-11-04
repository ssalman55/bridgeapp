# Brevo SMTP Configuration Guide

This guide explains how to configure the StaffBridge backend to use Brevo (formerly Sendinblue) for sending transactional emails.

## Brevo SMTP Settings

Brevo provides SMTP servers for sending transactional emails. Use the following settings:

### SMTP Configuration

- **SMTP Host**: `smtp-relay.brevo.com` (recommended) or `smtp.brevo.com`
- **SMTP Port**: `587` (STARTTLS - recommended) or `465` (SSL)
- **Security**: TLS/STARTTLS required
- **Authentication**: Required (SMTP Key, not account password)

## Required Environment Variables

Add these environment variables to your backend `.env` file or deployment platform:

```bash
# Brevo SMTP Configuration
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-brevo-smtp-key
```

**Important Notes:**
- `SMTP_USER` should be a verified sender email address in your Brevo account
- `SMTP_PASSWORD` should be your Brevo SMTP Key (NOT your account password)
- You can also use `SMTP_PASS` instead of `SMTP_PASSWORD`

## How to Get Your Brevo SMTP Key

1. **Sign up/Login to Brevo**: Go to https://www.brevo.com/
2. **Navigate to SMTP & API**: 
   - Go to Settings → SMTP & API
   - Or visit: https://app.brevo.com/settings/keys/api
3. **Create SMTP Key**:
   - Click "Generate New Key"
   - Select "SMTP" as the key type
   - Copy the generated key (this is your `SMTP_PASSWORD`)
   - **Important**: Copy the key immediately - you won't be able to see it again
4. **Verify Sender Email**:
   - Go to Senders → Add a sender
   - Verify your email address (`SMTP_USER`)
   - This email will appear as the "From" address in emails

## Email Actions That Trigger Notifications

The following actions in the mobile app (via API) trigger email notifications:

### 1. Leave Requests
- **Trigger**: User submits a leave request
- **Recipients**: All admins in the organization
- **Function**: `sendLeaveRequestEmail()`
- **Endpoint**: `POST /api/leave`

### 2. Leave Approval/Rejection
- **Trigger**: Admin approves or rejects a leave request
- **Recipients**: The user who submitted the request
- **Functions**: `sendLeaveApprovalEmail()`, `sendLeaveRejectionEmail()`
- **Endpoint**: `PATCH /api/leave/requests/:id`

### 3. Bulletin Board Posts
- **Trigger**: Admin creates a new bulletin post
- **Recipients**: All active users in the organization
- **Function**: `sendBulletinPostEmail()`
- **Endpoint**: `POST /api/bulletin`

### 4. Calendar Events
- **Trigger**: Admin creates a new calendar event
- **Recipients**: All active users in the organization
- **Function**: `sendCalendarEventEmail()`
- **Endpoint**: `POST /api/calendar/events` or `POST /api/events`

### 5. Event Request Submission
- **Trigger**: Staff submits an event request requiring approval
- **Recipients**: All admins in the organization
- **Function**: `sendEventRequestSubmissionEmail()`
- **Endpoint**: `POST /api/events/request`

### 6. Peer Recognition
- **Trigger**: User submits a peer recognition
- **Recipients**: All admins in the organization (for approval)
- **Function**: `sendPeerRecognitionEmail()`
- **Endpoint**: `POST /api/recognitions`

### 7. Training Requests
- **Trigger**: User submits a training request
- **Recipients**: All admins in the organization
- **Function**: `sendTrainingRequestEmail()`
- **Endpoint**: `POST /api/training-requests`

### 8. Expense Claims
- **Trigger**: User submits an expense claim
- **Recipients**: All admins in the organization
- **Function**: `sendExpenseClaimEmail()`
- **Endpoint**: `POST /api/expense-claims`

### 9. Inventory Requests
- **Trigger**: User submits an inventory request
- **Recipients**: All admins in the organization
- **Function**: `sendInventoryRequestSubmissionEmail()`
- **Endpoint**: `POST /api/inventory/requests`

### 10. Performance Evaluations
- **Trigger**: Admin creates a performance evaluation for a staff member
- **Recipients**: The staff member being evaluated
- **Function**: `sendPerformanceEvaluationEmail()`
- **Endpoint**: `POST /api/performance-evaluations`

### 11. Task Assignment
- **Trigger**: Admin assigns a task to a staff member
- **Recipients**: The assigned staff member
- **Function**: `sendNewTaskAssignedEmail()`
- **Endpoint**: `POST /api/tasks`

### 12. Welcome Emails
- **Trigger**: New user registration
- **Recipients**: The newly registered user
- **Function**: `sendWelcomeEmail()`
- **Endpoint**: `POST /api/auth/register`

## Testing SMTP Configuration

To test your Brevo SMTP configuration, you can use the test script:

```bash
cd Read\ Me/NewReadBE
node test-smtp-connection.js
```

Or check the backend logs when the server starts - you should see:
```
SMTP server is ready to send emails
SMTP Configuration: {
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  user: 'your-email@yourdomain.com'
}
```

## Troubleshooting

### Common Issues

1. **"Invalid login" Error (535)**
   - **Cause**: Incorrect SMTP credentials
   - **Solution**: 
     - Verify your `SMTP_USER` is a verified sender in Brevo
     - Ensure `SMTP_PASSWORD` is the SMTP Key, not your account password
     - Regenerate the SMTP key if needed

2. **"Connection timeout" Error**
   - **Cause**: Network/firewall issues or incorrect host
   - **Solution**: 
     - Verify `SMTP_HOST` is `smtp-relay.brevo.com`
     - Check firewall allows outbound connections on port 587
     - Try port 465 with `secure: true`

3. **"TLS required" Error**
   - **Cause**: Port 587 requires STARTTLS
   - **Solution**: Ensure `SMTP_PORT=587` and `secure: false` (handled automatically)

4. **Emails Not Sending**
   - **Check**: Backend logs for error messages
   - **Verify**: Environment variables are set correctly
   - **Test**: Use the test script to verify SMTP connection

### Brevo Account Limits

- **Free Plan**: 300 emails/day
- **Lite Plan**: 10,000 emails/month
- **Premium Plans**: Higher limits based on subscription

Check your Brevo dashboard to monitor email usage and ensure you're within limits.

## Mobile App Integration

The mobile app doesn't send emails directly. It makes API calls to the backend endpoints listed above. The backend email service automatically sends emails when:

1. The API endpoint is called successfully
2. The action requires email notification
3. There are valid recipients (admins/users in the same organization)
4. SMTP configuration is correct

**No changes needed in the mobile app** - it already correctly triggers all email-sending endpoints.

## Deployment Configuration (Render.com, Heroku, etc.)

When deploying to production:

1. **Add Environment Variables** in your deployment platform:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=your-email@yourdomain.com
   SMTP_PASSWORD=your-brevo-smtp-key
   ```

2. **Restart the Service** after adding environment variables

3. **Check Logs** to verify SMTP connection on startup

## Security Best Practices

1. **Never commit SMTP credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate SMTP keys** periodically
4. **Monitor email sending** through Brevo dashboard
5. **Set up email alerts** for failed sends in Brevo

## Additional Resources

- Brevo SMTP Documentation: https://help.brevo.com/hc/en-us/articles/209467485
- Brevo Dashboard: https://app.brevo.com/
- Brevo API Documentation: https://developers.brevo.com/


