# Microsoft Teams Integration Guide

## Overview

The Microsoft Teams integration allows organization admins to enable direct Teams calling from the Staff Profiles page within StaffBridge. With a single click, users can initiate a Teams call with any staff member using their email address.

---

## For Organization Administrators

### Prerequisites

Before enabling Teams integration, ensure you have:

1. **Microsoft Azure Account** with administrative access
2. **Microsoft Entra ID (formerly Azure AD)** configured for your organization
3. **Application Registration** in Azure for Teams integration
4. **Teams Desktop App or Web Access** on user devices

### Getting Started

#### Step 1: Register an Application in Azure

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Entra ID → App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: `StaffBridge Teams Integration`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `https://your-staffbridge-domain/api/sso/callback`
5. Click **Register**

#### Step 2: Gather Credentials

After registration, you'll need:

1. **Application (Client) ID**
   - Found on the app's **Overview** page
   - Copy and save this

2. **Tenant ID**
   - Also on the **Overview** page
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

3. **Client Secret**
   - Go to **Certificates & secrets**
   - Click **New client secret**
   - **Expiration**: Select 24 months
   - Copy the **Value** immediately (you won't be able to view it again)

#### Step 3: Configure in StaffBridge

1. Log in to StaffBridge as an **Admin**
2. Navigate to **Admin Menu → Teams Integration Settings**
3. Fill in the configuration:

   **Azure Entra ID Section:**
   - Toggle **Enable Azure Entra ID** to ON
   - Enter **Tenant ID**
   - Enter **Client ID**
   - Enter **Client Secret**
   - Click **Test Connection** to verify credentials

4. **Teams Calling Integration Section:**
   - Toggle **Enable Teams Calling** to ON
   - Select **Call Launch Mode**:
     - **Deep Link** (Recommended): Best compatibility - uses Teams app if available, falls back to web
     - **Teams App**: Requires Teams desktop app installed
     - **Teams Web**: Always opens Teams web interface
   - Click **Save Configuration**

✅ **Teams integration is now active!**

---

### How It Works

Once enabled, Teams buttons appear next to the eye icon on the Staff Profiles page:

- **Click the Teams button** next to any staff member
- Teams automatically opens and initiates a call with their email
- Call can be made from Teams desktop app or web interface

### Troubleshooting for Admins

**Problem**: "Test Connection" fails
- **Solution**: Verify Tenant ID and Client ID are correct. Check they're not mistyped or swapped.

**Problem**: Teams button doesn't appear on Staff Profiles
- **Solution**: 
  1. Ensure "Enable Teams Calling" toggle is ON
  2. Refresh the page or clear browser cache
  3. Verify you're logged in as an Admin

**Problem**: Clicking Teams button does nothing
- **Solution**:
  1. Ensure Microsoft Teams is installed or open Teams web (web.teams.microsoft.com)
  2. Try different call mode (Deep Link → Teams App → Teams Web)
  3. Check browser console for error messages

**Problem**: "Call mode" not showing options
- **Solution**: First enable "Enable Azure Entra ID" and "Enable Teams Calling" toggles.

---

## For End Users

### Using Teams Calling

Once your admin has enabled Teams integration:

1. **Navigate to Staff Profiles**
   - From sidebar: **People → Staff Profiles**

2. **View Available Staff**
   - See all staff members in your organization
   - View by **Table** or **Card** layout

3. **Initiate Teams Call**
   - Click the **blue Teams button** (💬) next to any staff member
   - The button appears next to the eye icon in the Actions column

4. **What Happens Next**
   - **If you have Teams installed**: Teams desktop app opens with call ready
   - **If Teams not installed**: Teams web (web.teams.microsoft.com) opens
   - Call initiates with the selected staff member's email

5. **Accept the Call**
   - The recipient receives a Teams call notification
   - They can accept or decline the call
   - Once accepted, you can start your conversation

### System Requirements

- **Microsoft Teams** (desktop app or web access at web.teams.microsoft.com)
- **Active Microsoft account** with your organization's domain
- **Internet connection**
- **Supported browsers**: Chrome, Edge, Safari, Firefox (latest versions)

### Tips

✅ **Best Practices:**
- Ensure your Teams presence status is updated
- Have headphones or microphone ready before calling
- Call during business hours for better response rates
- Use Teams chat for quick non-urgent messages

❌ **Avoid:**
- Calling during off-hours without advance notice
- Initiating calls without purpose (use chat first if quick question)
- Multiple simultaneous calls (Teams handles one call at a time)

---

## Feature Details

### Call Modes Explained

| Mode | How It Works | Best For |
|------|-------------|----------|
| **Deep Link (Recommended)** | Detects Teams app, uses it if available, else falls back to web | Most compatible; works everywhere |
| **Teams App** | Always opens Teams desktop app | Dedicated Teams users |
| **Teams Web** | Always opens Teams web interface | Users without desktop app |

### Security

- ✅ **Credentials Secured**: Client Secret never exposed to frontend
- ✅ **API Protected**: Only authenticated admins can configure
- ✅ **Per-Organization**: Each organization has separate configuration
- ✅ **Email-Based**: Calls use official email addresses, preventing misidentification

### Privacy

- 📧 **Email Only**: System only accesses staff member email addresses
- 🔒 **No Recording**: Teams call recording is controlled by Teams permissions
- 📱 **User Initiated**: Users manually click to call; no automated calling

---

## Frequently Asked Questions (FAQs)

### Can I call someone if Teams integration is disabled?
**No.** The Teams button only appears when enabled. You can still use Teams directly to call colleagues.

### What if someone doesn't have a Teams account?
**Limitation:** They won't receive the call. Ensure all staff members have active Teams accounts in your organization.

### Can I schedule calls through StaffBridge?
**Not Yet.** Currently only instant calls are supported. Scheduled calls require using Teams directly.

### Is there a call history?
**Yes.** All calls go through Microsoft Teams, so call history is maintained in Teams itself.

### What if I call someone by mistake?
**Easy Fix:** Hang up immediately. No penalties or issues with accidental calls.

### Can admins disable Teams calling temporarily?
**Yes.** Go to **Admin Menu → Teams Integration Settings** and toggle **Enable Teams Calling** to OFF. Current calls won't be affected; only new calls will be blocked.

### How do I know if someone's available?
**Check Teams Status:** Teams shows presence status (Available, In a Call, Away, etc.) when you attempt to call.

---

## Support

### For Admins Having Issues:
1. Check the **How It Works** section above
2. Review **Troubleshooting for Admins**
3. Contact your IT department with the error message
4. Provide the screenshot of the Teams Integration Settings page

### For Users Having Issues:
1. Verify **System Requirements**
2. Try a different **Call Mode** (ask your admin to change it)
3. Ensure you have the latest **Teams version**
4. Clear browser cache and refresh
5. Contact your organization's IT support

---

## Security & Compliance

- **Data**: Only email addresses are used for Teams routing
- **Compliance**: Integrates with your existing Microsoft Entra ID security policies
- **Encryption**: All calls use Microsoft Teams' end-to-end encryption
- **Audit**: All configurations are logged and can be reviewed

---

## Version Information

- **Feature Release Date**: October 2024
- **Supported Browsers**: All modern browsers (Chrome 90+, Edge 90+, Safari 14+, Firefox 88+)
- **Platform Compatibility**: Windows, macOS, Linux, iOS, Android

---

## Contact & Feedback

For issues or feature requests:
1. **In-App Help**: Click **Help** in the app footer
2. **Email IT Support**: [your-support-email]
3. **Schedule Support Call**: Use StaffBridge Teams integration to call IT directly!

---

**Last Updated**: October 24, 2024
**Status**: ✅ Active and Ready to Use


