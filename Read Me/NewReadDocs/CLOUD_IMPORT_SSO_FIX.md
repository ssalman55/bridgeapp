# Cloud Import SSO Configuration Fix

## Issue
User is getting "Microsoft Entra ID credentials not found" despite having SSO configured.

## Root Cause
The code was looking for SSO credentials in the wrong format. The SSO Configuration API returns data in a nested structure, and we need to handle different provider IDs.

## Changes Made

### 1. Added SSO Config Fetching
Now fetches SSO configuration separately to get Microsoft Azure Client ID.

### 2. Improved Provider Detection
The code now looks for Microsoft provider using multiple possible names:
- `microsoft`
- `azure`
- `entra`
- `Microsoft` (with capital M)

### 3. Added Fallback Structure Handling
Handles both possible data structures:
```javascript
// Structure 1: Data nested in data object
{
  success: true,
  data: {
    providers: [...]
  }
}

// Structure 2: Direct providers array
{
  providers: [...]
}
```

### 4. Added Debug Logging
Console logs will show:
- The full SSO config structure
- The extracted Microsoft Client ID

## Testing Instructions

1. Open browser console (F12)
2. Navigate to Document Library
3. Click "Import from Cloud" → "Import from OneDrive"
4. Check console logs for:
   - "SSO Config:" - shows the structure
   - "Microsoft Client ID:" - shows the extracted ID

## If Still Getting Error

### Check SSO Configuration Test
1. Go to Admin → SSO Configuration
2. Click the "Test" button next to Microsoft Entra ID
3. If connection fails, the credentials might be incorrect

### Verify Credentials Match
The credentials must match your Azure App Registration:
- **Client ID**: `fb4ef307-2099-49fb-8197-b6fdeadd726d`
- **Client Secret**: Must be set (currently empty in screenshot)
- **Tenant ID**: `e5b615a4-144b-4edd-9812-fbdfd5c13008`

### Common Issues
1. **Client Secret is empty**: Must enter the client secret from Azure portal
2. **Wrong Tenant ID**: Must match your Azure AD tenant
3. **Wrong Client ID**: Must match your Azure app registration
4. **Status shows "disconnected"**: Credentials need to be saved and tested

## Next Steps
1. Save the Client Secret in SSO Configuration
2. Click "Test" to verify connection
3. Once connection is successful, try OneDrive import again


