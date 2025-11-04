# SSO Setup for Mobile App

This document describes the SSO (Single Sign-On) implementation for the StaffBridge mobile app.

## Overview

The mobile app supports SSO authentication using Microsoft Entra ID or Google Workspace. When a user enters their email address, the app automatically discovers if their organization has SSO configured and displays SSO login options.

## Mobile App Implementation

### Features

1. **Automatic SSO Discovery**: When a user enters their email address, the app automatically checks if their organization has SSO configured.
2. **SSO Provider Selection**: If SSO is available, the app displays buttons for available providers (Microsoft Entra ID or Google Workspace).
3. **Seamless Authentication**: Uses OAuth 2.0 flow with PKCE for secure authentication.

### Dependencies

- `expo-web-browser`: For opening OAuth authentication URLs in the system browser

### Deep Linking Configuration

The app is configured to handle SSO callbacks via deep linking:
- **URL Scheme**: `staffbridge://sso-callback`
- **iOS**: Configured in `app.json` with bundle identifier
- **Android**: Configured with intent filters in `app.json`

## Backend Configuration Required

### Important: Backend Redirect URI Configuration

The backend SSO callback handler currently redirects to `${FRONTEND_URL}/sso-callback?token=...`. For the mobile app to work properly, **one of the following configurations is required**:

#### Option 1: Backend Mobile Detection (Recommended)

Modify the backend SSO callback handler (`Read Me/NewReadBE/src/controllers/ssoController.js`) to detect mobile user agents and redirect to the custom URL scheme:

```javascript
// In handleSSOCallback function, replace:
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const redirectUrl = `${frontendUrl}/sso-callback?token=${token}`;

// With:
const userAgent = req.get('User-Agent') || '';
const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

let redirectUrl;
if (isMobile) {
  // Redirect to mobile app custom scheme
  redirectUrl = `staffbridge://sso-callback?token=${token}`;
} else {
  // Redirect to web frontend
  redirectUrl = `${frontendUrl}/sso-callback?token=${token}`;
}
```

#### Option 2: Web Redirect Page

Create a web page at `FRONTEND_URL/sso-callback` that detects if the app is installed and redirects to the custom scheme:

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // Extract token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // Try to redirect to mobile app
      const appUrl = `staffbridge://sso-callback?token=${token}`;
      window.location.href = appUrl;
      
      // Fallback: if app not installed, show error or redirect to login
      setTimeout(() => {
        window.location.href = '/login?error=mobile_app_required';
      }, 2000);
    }
  </script>
</head>
<body>
  <p>Redirecting to mobile app...</p>
</body>
</html>
```

#### Option 3: Environment Variable for Mobile Redirect

Add a new environment variable `MOBILE_REDIRECT_SCHEME` and modify the backend to use it:

```javascript
const mobileRedirectScheme = process.env.MOBILE_REDIRECT_SCHEME || 'staffbridge';
const redirectUrl = `${mobileRedirectScheme}://sso-callback?token=${token}`;
```

### SSO Provider Configuration

Ensure that the SSO provider (Microsoft Entra ID or Google Workspace) redirect URI is configured to point to the backend callback endpoint:

- **Microsoft Entra ID**: Redirect URI should be `https://your-backend.com/api/sso/callback`
- **Google Workspace**: Redirect URI should be `https://your-backend.com/api/sso/callback`

## Usage Flow

1. User enters email address in login screen
2. App automatically discovers SSO providers (if configured)
3. If SSO is available, user sees "Sign in with Microsoft Entra ID" or "Sign in with Google Workspace" buttons
4. User taps SSO button
5. System browser opens with OAuth authentication page
6. User authenticates with their IdP
7. IdP redirects to backend callback
8. Backend processes callback and redirects to mobile app via custom URL scheme
9. Mobile app receives token and completes login

## Testing

1. Ensure backend is configured with SSO providers
2. Enter an email address from an organization with SSO configured
3. Verify SSO buttons appear
4. Tap SSO button and complete authentication
5. Verify successful login

## Troubleshooting

### SSO buttons don't appear
- Verify the organization has SSO configured in the backend
- Check that the email domain matches an organization with SSO enabled
- Verify network connectivity

### SSO callback fails
- Verify backend redirect URI is configured correctly (see Backend Configuration above)
- Check that deep linking is properly configured in `app.json`
- Verify the custom URL scheme matches between backend redirect and mobile app configuration

### Token not received
- Check backend logs for SSO callback processing
- Verify the redirect URL in the backend matches the mobile app's custom scheme
- Ensure the backend callback handler is correctly configured

## Security Considerations

1. **PKCE**: The implementation uses PKCE (Proof Key for Code Exchange) for enhanced security
2. **Token Storage**: Tokens are stored securely using `expo-secure-store`
3. **State Validation**: OAuth state is validated to prevent CSRF attacks
4. **Token Expiration**: Tokens expire after 24 hours and require re-authentication

