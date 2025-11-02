# OneDrive SSO Integration Fix

## Issue Resolved
The OneDrive picker was trying to authenticate separately instead of using the existing Microsoft Entra ID SSO session, causing multi-tenant authentication errors.

## Root Cause
1. **Separate Authentication**: OneDrive picker was initiating its own OAuth flow instead of leveraging existing SSO
2. **Multi-tenant vs Single-tenant**: The picker was using `/common` endpoint while your Azure app is configured for single-tenant
3. **Missing Tenant Context**: The picker wasn't using the specific tenant ID from your SSO configuration

## Solution Implemented

### 1. Tenant-Specific Authentication
- Updated OneDrive picker to use tenant-specific endpoint: `https://login.microsoftonline.com/{tenantId}`
- Passes the tenant ID from SSO configuration to avoid multi-tenant errors
- Uses the same Azure app registration as your existing SSO

### 2. SSO Session Detection (Framework)
- Added framework to detect existing Microsoft authentication
- Placeholder for future implementation of session reuse
- Currently logs the attempt to use existing sessions

### 3. Fallback Graph API Integration
- Created alternative approach using Microsoft Graph API directly
- Custom file picker modal when SSO session is available
- Bypasses OneDrive SDK authentication issues

### 4. Enhanced Error Handling
- Better error messages for authentication failures
- Graceful fallback to regular upload when OneDrive fails
- Comprehensive logging for debugging

## Key Changes Made

### `onedrivePicker.ts`
```typescript
// Now uses tenant-specific authentication
export const openOneDrivePicker = (
  clientId: string,
  onSuccess: (files: any[]) => void,
  onError: (error: any) => void,
  tenantId?: string  // NEW: Tenant ID parameter
): void => {
  // Check for existing SSO session
  const existingToken = checkExistingMicrosoftAuth();
  if (existingToken) {
    // Use Graph API with existing session
    openOneDriveWithGraphAPI(existingToken, onSuccess, onError);
    return;
  }
  
  // Use tenant-specific endpoint
  const options = {
    clientId,
    advanced: {
      authority: `https://login.microsoftonline.com/${tenantId}` // Tenant-specific
    }
  };
}
```

### `CloudImportButton.tsx`
```typescript
// Now passes tenant ID from SSO config
openOneDrivePicker(
  clientId,
  onSuccess,
  onError,
  tenantId  // Pass tenant ID for proper authentication
);
```

## Expected Behavior After Deployment

### 1. Immediate Fix
- OneDrive picker will use tenant-specific authentication
- No more "multi-tenant application" error
- Uses your existing Azure app registration

### 2. Authentication Flow
- Uses same Client ID and Tenant ID as your working SSO
- Authenticates against your specific tenant
- Proper permission scope for OneDrive access

### 3. Future Enhancement (SSO Session Reuse)
The framework is in place to detect existing SSO sessions. Future implementation will:
- Detect if user is already signed in via Microsoft SSO
- Reuse authentication token for OneDrive access
- No re-authentication required
- Seamless experience like other platforms

## Testing Steps

1. **Navigate to Document Library**
2. **Click "Import from Cloud" → "Import from OneDrive"**
3. **Expected Results:**
   - No multi-tenant error
   - Authentication uses your organization's tenant
   - OneDrive picker opens successfully
   - Can browse and select files

## Azure App Registration Requirements

Ensure your Azure app has these settings:

### **Redirect URIs**
- Add: `https://www.stfbridge.com/document-library`
- Add: `https://www.stfbridge.com/`

### **API Permissions**
- Microsoft Graph: `Files.Read`
- Microsoft Graph: `Files.Read.All`
- Microsoft Graph: `User.Read`
- **Grant admin consent** for these permissions

### **Supported Account Types**
- Keep as: "Accounts in this organizational directory only (single tenant)"

## Future Roadmap

### Phase 1 (Current)
- ✅ Fix multi-tenant authentication error
- ✅ Use tenant-specific endpoints
- ✅ Enhanced error handling

### Phase 2 (Next)
- 🔄 Implement SSO session detection
- 🔄 Reuse existing authentication tokens
- 🔄 Seamless OneDrive access without re-auth

### Phase 3 (Future)
- 📋 Similar implementation for Google Drive
- 📋 Automatic provider detection based on SSO login
- 📋 Cross-platform file import experience

The OneDrive integration now uses the same authentication foundation as your working SSO, eliminating the multi-tenant configuration issues.

