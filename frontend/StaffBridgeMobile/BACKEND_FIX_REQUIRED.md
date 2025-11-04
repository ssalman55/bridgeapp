# Backend Fix Required for SSO Discovery

## Problem
The mobile app correctly identifies `/api/sso/discover` as a public endpoint and does NOT send an Authorization header. However, the backend returns **401 "Not authorized, no token provided"**.

## Root Cause
The issue is likely one of the following:

### Issue 1: Subscription Middleware Path Check
The subscription middleware (`subscriptionMiddleware.js` line 15-16) checks:
```javascript
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/sso/discover', '/sso/initiate', '/sso/callback', '/sso/break-glass-login'];
if (authRoutes.some(route => req.path.startsWith(route))) {
  return next();
}
```

**Problem**: `req.path` is relative to the router mount point. Since SSO routes are mounted at `/api/sso`, `req.path` is `/discover`, not `/sso/discover`. This means the subscription middleware doesn't recognize SSO routes as public.

**Fix**: Use `req.originalUrl` instead of `req.path`, or check for `/discover` instead of `/sso/discover`:

```javascript
// Option 1: Use req.originalUrl (full path)
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/sso/discover', '/sso/initiate', '/sso/callback', '/sso/break-glass-login'];
if (authRoutes.some(route => req.originalUrl.includes(route))) {
  return next();
}

// Option 2: Check for router-specific paths
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/discover', '/initiate', '/callback', '/break-glass-login'];
if (authRoutes.some(route => req.path.startsWith(route))) {
  return next();
}
```

### Issue 2: Global Protect Middleware
There might be a global middleware applying `protect` to all `/api` routes before the SSO routes are handled.

**Fix**: Ensure no global middleware is applying `protect` to all routes. Check `index.js` for any `app.use(protect)` before route mounting.

## Files to Fix

1. **`src/middleware/subscriptionMiddleware.js`** (line 15-16)
   - Change `req.path.startsWith(route)` to `req.originalUrl.includes(route)` OR
   - Update authRoutes to include router-relative paths (`/discover` instead of `/sso/discover`)

2. **`src/index.js`**
   - Verify no global `protect` middleware is applied to all `/api` routes
   - Ensure SSO routes are mounted correctly: `app.use('/api/sso', ssoRoutes);`

3. **`src/routes/ssoRoutes.js`**
   - Verify `/discover` route is defined BEFORE `router.use(protect)` (line 17 before line 23)

## Expected Behavior
- `/api/sso/discover` should accept requests WITHOUT authentication
- `/api/sso/initiate` should accept requests WITHOUT authentication  
- `/api/sso/callback` should accept requests WITHOUT authentication
- `/api/sso/break-glass-login` should accept requests WITHOUT authentication

## Testing
After fixing, test with:
```bash
curl -X POST https://your-backend-url/api/sso/discover \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Should return 200 (or 404 if no SSO config), NOT 401.

## Mobile App Status
✅ Mobile app is correctly configured and ready to work once backend is fixed.

