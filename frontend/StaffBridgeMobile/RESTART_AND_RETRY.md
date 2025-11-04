# Step-by-Step: Get Callback Logs

## Step 1: Restart Backend Server
**Important:** The backend needs to be restarted to load the latest code changes with enhanced logging.

1. Restart your backend server (on Render.com or wherever it's hosted)
2. Wait for it to fully start up
3. Verify it's running and healthy

## Step 2: Clear Mobile App State (Optional but Recommended)
1. Close the mobile app completely
2. Reopen it
3. Go to login screen

## Step 3: Initiate SSO Flow
1. Enter email: `sahmad@acsdoha.school`
2. Tap "Sign in with SSO"
3. Tap "Continue with Microsoft Entra ID"
4. Complete Microsoft authentication in the browser

## Step 4: Watch Backend Logs in Real-Time
**CRITICAL:** Keep your backend logs open and watch them in real-time as you complete authentication.

When Microsoft redirects back, you should IMMEDIATELY see:

```
=== SSO ROUTE REQUEST ===
SSO Route method: GET
SSO Route path: /callback
SSO Route original URL: /api/sso/callback

🔵 === SSO CALLBACK STARTED ===
```

If you DON'T see these logs, the callback isn't being hit (which would explain the web redirect).

## Step 5: Share ALL Logs
After completing authentication, share:
1. ✅ Initiation logs (you already have these)
2. ❓ **Callback logs** (the missing piece - look for `/callback` or `CALLBACK`)
3. Any error messages

## What We're Looking For

The callback logs will show us:
- Is the callback route being hit?
- Is platform retrieved from database?
- What redirect URL is generated?
- Why is it choosing web vs mobile?

## If No Callback Logs Appear

If you don't see callback logs even after restarting backend:
1. Check that Microsoft is redirecting to: `https://backend-y16q.onrender.com/api/sso/callback`
2. Verify the redirect URL in Microsoft Azure AD configuration
3. Check if there are any errors in backend logs

**Please restart the backend server and try the flow again, watching the logs in real-time.**

