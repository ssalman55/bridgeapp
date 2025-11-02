# OneDrive Picker Troubleshooting Guide

## Issue
OneDrive picker opens the StaffBridge landing page instead of the OneDrive file browser.

## Root Cause Analysis

The issue is likely caused by one of these factors:

### 1. OneDrive SDK Loading Issues
- The Microsoft OneDrive SDK (`https://js.live.net/v7.2/OneDrive.js`) may not be loading properly
- Network restrictions or CORS issues preventing SDK access
- SDK initialization timing problems

### 2. Redirect URI Configuration
- The `redirectUri` in the picker options may be causing the redirect to the landing page
- Microsoft's OAuth flow might be redirecting incorrectly

### 3. Client ID/Authentication Issues
- The Client ID from SSO configuration might not have the correct permissions
- The Azure app registration might not be configured for OneDrive access

## Changes Made

### 1. Enhanced OneDrive Picker (`onedrivePicker.ts`)
- Added comprehensive console logging for debugging
- Improved SDK loading with proper initialization checks
- Updated redirect URI to be more specific (`/document-library`)
- Added better error handling and retry logic

### 2. Fallback Error Handling (`CloudImportButton.tsx`)
- Added try-catch wrapper around OneDrive picker calls
- Improved error messages to guide users to regular upload
- Added console logging for debugging

### 3. Alternative MSAL Implementation (`msalOneDrive.ts`)
- Created a backup implementation using Microsoft Authentication Library
- Uses Microsoft Graph API directly instead of OneDrive SDK
- Provides a custom file picker modal as fallback

## Debugging Steps

### 1. Check Console Logs
After deployment, open browser console (F12) and try OneDrive import. Look for:
```
Opening OneDrive picker with clientId: fb4ef307-2099-49fb-8197-b6fdeadd726d
OneDrive SDK not loaded, loading now...
Loading OneDrive SDK...
OneDrive SDK loaded successfully
OneDrive SDK available, opening picker...
Calling OneDrive.open with options: {...}
```

### 2. Verify Azure App Registration
The Azure app registration needs these settings:
- **Redirect URIs**: Add `https://www.stfbridge.com/document-library`
- **API Permissions**: 
  - Microsoft Graph: `Files.Read`
  - Microsoft Graph: `Files.Read.All`
  - Microsoft Graph: `User.Read`
- **Supported account types**: Accounts in this organizational directory only

### 3. Check Network Issues
- Verify `https://js.live.net/v7.2/OneDrive.js` loads in browser
- Check if there are any CORS or CSP restrictions

## Temporary Solution

For now, the system shows a user-friendly message:
> "OneDrive picker is currently under development. Please use the regular upload for now."

This allows users to continue using the document upload feature while OneDrive integration is being refined.

## Next Steps

### Option 1: Fix Current Implementation
1. Update Azure app registration with correct redirect URIs
2. Add required API permissions for OneDrive access
3. Test with proper OAuth flow

### Option 2: Implement MSAL Alternative
1. Install `@azure/msal-browser` package
2. Switch to the MSAL-based implementation
3. Use Microsoft Graph API directly for file access

### Option 3: Simplify Integration
1. Use a simple OAuth popup for authentication
2. Direct users to OneDrive web interface
3. Allow manual file selection and upload

## Testing Checklist

- [ ] Console shows proper Client ID extraction
- [ ] OneDrive SDK loads without errors
- [ ] Picker opens OneDrive interface (not landing page)
- [ ] File selection works correctly
- [ ] File import completes successfully
- [ ] Error handling works for various scenarios

## Support Information

If the issue persists after deployment:
1. Share console logs from browser developer tools
2. Verify Azure app registration settings
3. Test with different browsers/devices
4. Consider implementing the MSAL alternative approach

