# Email Notifications for Bulletin Posts and Calendar Events

This document describes the implementation of SMTP email notifications for bulletin board posts and calendar events in StaffBridge.

## Overview

When an admin user creates a new bulletin post or calendar event, the system automatically sends email notifications to all active users within the same organization. This ensures proper tenant isolation - users only receive notifications for content within their own organization.

## Features

### Bulletin Board Posts
- **Trigger**: Admin creates a new bulletin post
- **Recipients**: All active users in the same organization
- **Content**: Post title, body, admin details, and organization information
- **Email Template**: Professional HTML template with StaffBridge branding

### Calendar Events
- **Trigger**: Admin creates a new calendar event
- **Recipients**: All active users in the same organization
- **Content**: Event title, description, date, time, location, and admin details
- **Email Template**: Professional HTML template with event details

## Implementation Details

### Email Service Functions

#### `sendBulletinPostEmail({ organization, users, admin, post })`
- Sends bulletin post notifications to all users in an organization
- Includes retry mechanism (3 attempts) for reliability
- Logs detailed success/failure information
- Handles SMTP connection errors gracefully

#### `sendCalendarEventEmail({ organization, users, admin, event })`
- Sends calendar event notifications to all users in an organization
- Includes retry mechanism (3 attempts) for reliability
- Logs detailed success/failure information
- Handles SMTP connection errors gracefully

### Controllers Updated

#### Bulletin Controller (`bulletinController.js`)
- `createPost` function now sends email notifications
- Fetches organization details and active users
- Calls email service with proper error handling
- Maintains existing notification system

#### Calendar Controller (`calendarController.js`)
- `createEvent` function now sends email notifications
- Fetches organization details and active users
- Calls email service with proper error handling
- Maintains existing notification system

#### Event Controller (`eventController.js`)
- `createEvent` function now sends email notifications
- Fetches organization details and active users
- Calls email service with proper error handling
- Maintains existing notification system

### Tenant Isolation

The system ensures proper tenant isolation by:
1. **Organization Filtering**: Only users in the same organization receive notifications
2. **User Status Check**: Only active users (not archived) receive notifications
3. **Admin Context**: Uses the admin's organization context for filtering
4. **Database Queries**: Proper MongoDB queries with organization filters

## Configuration

### Required Environment Variables

```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-email-password
```

### SMTP Settings

- **Port 465**: Uses SSL (secure: true)
- **Port 587**: Uses STARTTLS (secure: false)
- **Connection Timeout**: 30 seconds
- **Retry Mechanism**: 3 attempts with exponential backoff
- **TLS**: Required and enforced for security

## Email Templates

### Bulletin Post Template
- Professional header with StaffBridge logo
- Post title and body content
- Admin information (name, email)
- Organization details
- Call-to-action button to view bulletin board
- Responsive design for mobile and desktop

### Calendar Event Template
- Professional header with calendar icon
- Event details (title, description, date, time, location)
- Admin information (name, email)
- Organization details
- Call-to-action button to view calendar
- Responsive design for mobile and desktop

## Error Handling

### SMTP Connection Issues
- Automatic retry mechanism (3 attempts)
- Detailed error logging with context
- Graceful degradation (doesn't fail the main request)
- Connection timeout handling

### User Filtering Issues
- Organization validation before sending emails
- User status validation (excludes archived users)
- Fallback handling for missing organization data

## Testing

### Test Script
A test script is provided at `test-bulletin-calendar-email.js` to verify email functionality:

```bash
cd backend
node test-bulletin-calendar-email.js
```

### Test Data
The test script uses mock data to simulate:
- Organization details
- Admin user information
- Sample users
- Sample bulletin post
- Sample calendar event

## Monitoring and Logging

### Success Logging
- Number of emails sent successfully
- List of successful recipients
- Organization context information
- Email message IDs for tracking

### Error Logging
- Detailed error messages with context
- SMTP error codes and responses
- Retry attempt information
- Organization and user context

## Security Considerations

### Data Privacy
- Only organization members receive notifications
- No cross-organization data leakage
- Proper user filtering and validation

### SMTP Security
- TLS encryption required
- Secure authentication
- Connection timeout limits
- No sensitive data in logs

## Performance Considerations

### Email Sending
- Parallel email sending for multiple recipients
- Connection pooling for SMTP
- Retry mechanism with exponential backoff
- Non-blocking email operations

### Database Queries
- Efficient user filtering by organization
- Selective field projection (email, fullName only)
- User status filtering to reduce recipient count

## Troubleshooting

### Common Issues

1. **SMTP Connection Failed**
   - Check SMTP credentials and server settings
   - Verify network connectivity
   - Check firewall settings

2. **Authentication Failed**
   - Verify SMTP username and password
   - Check if 2FA is enabled (may require app password)
   - Verify account permissions

3. **No Emails Sent**
   - Check organization and user data
   - Verify user status (not archived)
   - Check email service logs

4. **Partial Email Delivery**
   - Check individual email delivery status
   - Verify recipient email addresses
   - Check spam/junk folders

### Debug Mode
Enable debug mode by setting `NODE_ENV=development`:
```bash
export NODE_ENV=development
```

This will enable:
- SMTP debug logging
- Detailed connection information
- Verbose error messages

## Future Enhancements

### Potential Improvements
- Email delivery tracking and analytics
- User email preferences (opt-in/opt-out)
- Customizable email templates
- Bulk email operations for large organizations
- Email scheduling and queuing
- A/B testing for email content

### Integration Opportunities
- Webhook notifications for external systems
- Slack/Teams integration
- SMS notifications for urgent announcements
- Push notifications for mobile apps 