# Critical: Backend Callback Logs Required

## Problem
After SSO authentication, the backend redirects to the web interface instead of the mobile app, even though `platform: 'mobile'` is being stored correctly during initiation.

## What We Know

✅ **Initiation is working correctly:**
- Mobile app sends `platform: 'mobile'` in `/sso/initiate` request
- Backend logs show: `Platform: mobile`
- OAuth state stored with: `platform: 'mobile'`

❓ **Callback logs are missing:**
- No callback logs visible in provided logs
- Need to see what happens when `/sso/callback` is hit

## Required Backend Logs

Please check your backend logs for the **SSO callback** (`/api/sso/callback`). Look for these log entries:

### Expected Logs:
```
=== SSO CALLBACK DEBUG ===
Query params: { code: true, state: '...', ... }
Session ID: ...
OAuth state from session: ...

Session state not found or mismatch, trying database...
Looking for state: [state value]
Found OAuth state in database: { platform: 'mobile', ... }
OAuth state reconstructed from database with platform: mobile

=== SSO REDIRECT DETECTION ===
OAuth State Platform: mobile
OAuth State Object: { ... }
User-Agent: ...
Is Mobile User-Agent: true/false
Is Mobile (final decision): true/false
Platform check - storedPlatform === "mobile": true/false

=== SSO REDIRECT (MOBILE) ===
Redirect URL: staffbridge://sso-callback?token=...
✅ Redirecting to mobile app
```

### Or if redirecting to web:
```
=== SSO REDIRECT (WEB) ===
⚠️ Redirecting to web (platform was: web)
```

## Possible Issues

### Issue 1: Platform Not Retrieved from Database
If the logs show `platform: 'web'` or `platform: undefined`, the platform field might not be:
- Saved correctly to database
- Retrieved correctly from database
- Included in the OAuth state object

**Check:** Look for "Found OAuth state in database" logs and verify `platform` field value.

### Issue 2: OAuth State Not Found
If logs show "OAuth state not found in database either!", the state might:
- Have expired (5 minute TTL)
- Not match between initiate and callback
- Be deleted before callback arrives

**Check:** Verify the state value matches between initiate and callback logs.

### Issue 3: Browser Handling Custom Scheme
Even if backend redirects to `staffbridge://sso-callback`, browsers might:
- Not recognize the custom scheme
- Show a web page instead
- Require user interaction to open the app

**Solution:** This is expected behavior with `expo-web-browser` - it should handle the redirect automatically.

## Next Steps

1. **Deploy the latest backend changes** (with enhanced logging)
2. **Run the SSO flow again**
3. **Check backend logs for `/api/sso/callback` endpoint**
4. **Share the callback logs** so we can see:
   - What platform value is retrieved
   - What redirect URL is generated
   - Whether mobile detection is working

## Debugging Commands

If you have database access, you can check if platform is being saved:

```javascript
// In MongoDB shell or database tool
db.oauthstates.find().sort({ createdAt: -1 }).limit(1)
// Should show: { ..., platform: "mobile", ... }
```

The logs will tell us exactly what's happening and why it's redirecting to web instead of mobile.

