# Mobile Redirect Fix for SSO Callback

## Problem
After SSO authentication, the backend redirects to the web interface (`stfbridge.com`) instead of returning to the mobile app via the custom URL scheme (`staffbridge://sso-callback`).

## Root Cause
The backend needs to detect that the SSO request originated from the mobile app and redirect to the custom URL scheme instead of the web URL.

## Changes Made

### 1. Backend Controller (`ssoController.js`)

#### `initiateSSO` Function
- Added `platform` parameter extraction from request body
- Stores `platform: 'mobile'` or `platform: 'web'` in OAuth state (both session and database)

#### `handleSSOCallback` Function
- Checks stored `platform` from OAuth state
- Falls back to User-Agent detection (`Mobile|Android|iPhone|iPad|okhttp`)
- Redirects to `staffbridge://sso-callback?token=...` for mobile
- Redirects to web URL for web requests

### 2. OAuthState Model (`OAuthState.js`)
- Added `platform` field to schema to store platform info in database

## Debugging Steps

### Check Backend Logs
After deploying the backend changes, check the backend logs when the SSO callback is triggered. You should see:

```
=== SSO REDIRECT DETECTION ===
OAuth State Platform: mobile
User-Agent: [user agent string]
Is Mobile User-Agent: true/false
Is Mobile: true/false
Full OAuth State: {...}
```

### Verify Platform Storage
Check the `/sso/initiate` logs to confirm platform is being stored:

```
=== SSO INITIATION DEBUG ===
Platform: mobile
```

## Deployment Checklist

1. ✅ Deploy backend changes to `ssoController.js`
2. ✅ Deploy backend changes to `OAuthState.js`
3. ✅ Restart backend server
4. ✅ Verify backend logs show platform detection
5. ✅ Test SSO flow from mobile app

## Expected Behavior

1. Mobile app calls `/sso/initiate` with `platform: 'mobile'`
2. Backend stores platform in OAuth state
3. User authenticates with IdP (Microsoft/Google)
4. IdP redirects to backend `/sso/callback`
5. Backend checks platform from OAuth state
6. Backend redirects to `staffbridge://sso-callback?token=...` for mobile
7. Mobile app receives the deep link and extracts the token
8. Mobile app completes login

## Troubleshooting

### Still redirecting to web?
1. **Check backend logs**: Verify platform is being stored and retrieved correctly
2. **Verify backend deployment**: Ensure the latest code is deployed
3. **Check User-Agent**: The User-Agent when IdP redirects might be a browser User-Agent, so we rely on stored platform
4. **Verify OAuth state**: Check that the OAuth state contains the platform field

### Custom URL scheme not opening app?
1. **Verify app.json**: Ensure `scheme: "staffbridge"` is configured
2. **Rebuild app**: Native changes require rebuilding the app
3. **Check deep linking**: Test the deep link manually: `staffbridge://sso-callback?token=test`

## Alternative Approach (If Custom Scheme Redirect Fails)

If browsers don't properly handle `staffbridge://` redirects, we can use a web redirect page that detects mobile and redirects to the app:

1. Create a web page at `FRONTEND_URL/sso-callback` that:
   - Extracts token from URL
   - Detects if running in mobile browser
   - Redirects to `staffbridge://sso-callback?token=...`
   - Falls back to web login if app not installed

However, the current approach (direct custom scheme redirect) should work with `expo-web-browser` as it's designed to handle custom scheme redirects.

