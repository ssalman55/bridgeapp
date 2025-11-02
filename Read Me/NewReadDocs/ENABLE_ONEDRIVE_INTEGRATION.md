# How to Enable OneDrive Integration

## Understanding the Architecture

OneDrive Cloud Import is a **separate feature** from:
- Microsoft Entra ID SSO (used for login)
- Teams Integration (used for calling/chatting)

You need to **explicitly enable** cloud import even if Entra ID SSO is already configured.

## Steps to Enable OneDrive Integration

### 1. Navigate to Cloud Import Settings

1. Login as an admin user
2. Go to the **Admin** menu (left sidebar)
3. Click on **"Cloud Import Settings"** (should be between "Teams Integration" and "Billing")

### 2. Enable Cloud Import

On the Cloud Import Settings page:
1. **Enable the global toggle**: "Enable Cloud Import" - This activates the feature globally for your organization
2. **Enable virus scanning**: Toggle "Virus Scanning" ON for security (recommended)
3. **Enable Microsoft OneDrive**: Toggle the "Microsoft OneDrive" switch ON
4. **Click "Save Settings"** button

### 3. Verify the Configuration

After saving:
1. Go to **Document Library** page
2. Click the **"Import from Cloud"** button
3. You should now see "Import from OneDrive" option (not showing an error)

## Important Notes

### Prerequisites

Even after enabling in Cloud Import Settings, you still need:
1. **Microsoft Entra ID SSO** to be configured (for authentication)
2. **OAuth App Registration** with OneDrive permissions

If you don't have the OAuth client ID configured, you'll see: "OneDrive integration not configured. Please contact your administrator."

### Why Separate Configuration?

- **SSO (Entra ID)**: Used for login/authentication
- **Teams Integration**: Used for calling/messaging staff
- **Cloud Import**: Used for importing documents from OneDrive/Google Drive

These are **independent features** that can be enabled/disabled separately.

## Troubleshooting

### Error: "OneDrive integration not configured"
- Go to Admin → Cloud Import Settings
- Enable "Microsoft OneDrive"
- Save settings
- If still getting error, check that OAuth credentials are properly configured in environment variables

### Error: "OneDrive integration is not enabled"
- The toggle in Cloud Import Settings might be OFF
- Or the global "Enable Cloud Import" toggle might be OFF
- Make sure both are enabled

### OneDrive Option Not Showing
- Check that both `enabled: true` and `microsoft.enabled: true` in the config
- The dropdown will only show enabled providers

## Current Status

According to the logs:
- The system fetched cloud import config successfully: `GET /api/cloud-import/config 200 794.489 ms`
- Config returned: `{"enabled": false, "microsoft": {"enabled": false}, ...}`
- This means OneDrive is currently **disabled** in the Cloud Import Settings

**Next Step**: Go to Admin → Cloud Import Settings and enable both:
1. ✅ Global "Enable Cloud Import" toggle
2. ✅ ✅ Microsoft OneDrive toggle


