# Frontend SSO Callback Solution

## Problem
Azure AD redirects to the frontend web URL (`https://stfbridge.com/sso-callback`) instead of the backend callback URL. This prevents the mobile app from receiving the authentication token.

## Solution
Create a frontend SSO callback page that:
1. Detects mobile browser (expo-web-browser)
2. Extracts OAuth `code` and `state` from URL
3. Calls backend `/api/sso/mobile-callback` endpoint
4. Receives token from backend
5. Redirects to mobile app custom scheme: `staffbridge://sso-callback?token=...`

## Implementation

### Step 1: Create Frontend Callback Page

I've created `public/sso-callback.html` which handles the mobile SSO callback flow.

**If you're using a React/SPA frontend**, you'll need to:

1. **Create a React component** at `/sso-callback` route:
   ```tsx
   // src/pages/SSOCallback.tsx or similar
   import { useEffect } from 'react';
   import { useSearchParams } from 'react-router-dom';
   import axios from 'axios';

   export default function SSOCallback() {
     const [searchParams] = useSearchParams();
     
     useEffect(() => {
       const code = searchParams.get('code');
       const state = searchParams.get('state');
       
       if (code && state) {
         // Call backend mobile callback endpoint
         axios.post(`${process.env.REACT_APP_API_URL || 'https://backend-y16q.onrender.com'}/api/sso/mobile-callback`, {
           code,
           state
         })
         .then(response => {
           if (response.data.success && response.data.token) {
             // Redirect to mobile app
             window.location.href = `staffbridge://sso-callback?token=${encodeURIComponent(response.data.token)}`;
           }
         })
         .catch(error => {
           console.error('SSO callback error:', error);
           // Redirect to login with error
           window.location.href = `/login?error=${encodeURIComponent(error.message)}`;
         });
       }
     }, [searchParams]);
     
     return <div>Processing SSO login...</div>;
   }
   ```

2. **Add route** in your React Router:
   ```tsx
   <Route path="/sso-callback" element={<SSOCallback />} />
   ```

### Step 2: Backend Endpoint (Already Created)

✅ Backend endpoint `/api/sso/mobile-callback` is already created in:
- `Read Me/NewReadBE/src/controllers/ssoController.js` - `handleMobileCallback` function
- `Read Me/NewReadBE/src/routes/ssoRoutes.js` - Route registered

### Step 3: Deploy Changes

1. **Deploy backend changes**:
   - Deploy `ssoController.js` with `handleMobileCallback` function
   - Deploy `ssoRoutes.js` with `/mobile-callback` route
   - Restart backend server

2. **Deploy frontend callback page**:
   - If using static HTML: Deploy `public/sso-callback.html` to your web server
   - If using React: Create and deploy the React component above
   - Ensure `/sso-callback` route is accessible on your frontend domain

## Flow Diagram

```
1. Mobile App → /sso/initiate (platform: 'mobile')
2. Backend → Stores platform: 'mobile' in OAuth state
3. Mobile App → Opens Microsoft Azure AD login
4. User → Authenticates with Microsoft
5. Azure AD → Redirects to: https://stfbridge.com/sso-callback?code=...&state=...
6. Frontend Page → Detects mobile browser
7. Frontend Page → POSTs code/state to: /api/sso/mobile-callback
8. Backend → Processes callback, returns token
9. Frontend Page → Redirects to: staffbridge://sso-callback?token=...
10. Mobile App → Receives token and completes login
```

## Testing

1. Test from mobile app
2. Complete Microsoft authentication
3. Verify frontend callback page loads
4. Check browser console for logs
5. Verify redirect to `staffbridge://sso-callback?token=...`
6. Verify mobile app receives token and logs in

## Notes

- The frontend callback page MUST be accessible at: `https://stfbridge.com/sso-callback`
- Azure AD redirect URI should be: `https://stfbridge.com/sso-callback` (frontend URL)
- The backend endpoint `/api/sso/mobile-callback` processes the OAuth code and returns the token
- The frontend page then redirects to the mobile app custom scheme

