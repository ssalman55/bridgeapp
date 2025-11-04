# SSO Discovery Backend Issue

## Problem
The mobile app correctly identifies `/api/sso/discover` as a public endpoint and does NOT send an Authorization header. However, the backend is returning **401 "Not authorized, no token provided"**.

## Root Cause
The backend route `/api/sso/discover` should be **public** (no authentication required) according to the routes file:
- File: `Read Me/NewReadBE/src/routes/ssoRoutes.js`
- Line 17: `router.post('/discover', ssoController.discoverOrganization);` is defined BEFORE `router.use(protect)` (line 23)

However, the deployed backend is rejecting requests without authentication, suggesting:
1. The deployed backend has a different version where `/discover` is accidentally protected
2. There's a global middleware protecting all `/api` routes
3. The route order is incorrect in the deployed version

## Evidence
- ✅ Mobile app correctly identifies endpoint as public: `[API Interceptor] Public endpoint - not adding token`
- ✅ Mobile app does NOT send Authorization header
- ❌ Backend returns 401: `POST /api/sso/discover 401`
- ❌ Backend error message: `"Not authorized, no token provided"`

## Expected Behavior
The `/api/sso/discover` endpoint should accept requests without authentication, as it's used to discover SSO configuration before login.

## Backend Fix Required
The backend team needs to verify that:
1. `/api/sso/discover` route is defined BEFORE `router.use(protect)` in the deployed version
2. There's no global middleware protecting all `/api` routes
3. The routes file matches the code in `Read Me/NewReadBE/src/routes/ssoRoutes.js`

## Mobile App Status
✅ Mobile app is correctly configured:
- API interceptor correctly identifies `/sso/discover` as public
- No Authorization header is sent for public endpoints
- Error handling properly displays backend error messages

## Next Steps
1. **Backend Team**: Verify route order in deployed backend
2. **Backend Team**: Check for global authentication middleware
3. **Backend Team**: Ensure `/api/sso/discover` accepts requests without tokens
4. Once backend is fixed, mobile app will work automatically

