# CRITICAL: Backend Fix Required - SSO Discovery Returns 401

## Current Status
- ❌ Backend still returns 401 "Not authorized, no token provided" for `/api/sso/discover`
- ✅ Mobile app is correctly configured (not sending token for public endpoints)
- ❌ Backend fix has NOT been applied yet

## Immediate Action Required

### Step 1: Fix Subscription Middleware
**File**: `src/middleware/subscriptionMiddleware.js`  
**Line**: 15-16

**Current Code (WRONG):**
```javascript
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/sso/discover', '/sso/initiate', '/sso/callback', '/sso/break-glass-login'];
if (authRoutes.some(route => req.path.startsWith(route))) {
  return next();
}
```

**Fixed Code (CORRECT):**
```javascript
// Use req.originalUrl to check full path, or check router-relative paths
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/sso/discover', '/sso/initiate', '/sso/callback', '/sso/break-glass-login'];
if (authRoutes.some(route => req.originalUrl.includes(route))) {
  return next();
}
```

**OR** use router-relative paths:
```javascript
// Alternative: Check for router-relative paths since SSO routes mount at /api/sso
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/discover', '/initiate', '/callback', '/break-glass-login'];
if (authRoutes.some(route => req.path.startsWith(route))) {
  return next();
}
```

### Step 2: Verify Route Order
**File**: `src/routes/ssoRoutes.js`

**Ensure this order:**
```javascript
// Public routes (no authentication required) - MUST BE BEFORE router.use(protect)
router.post('/discover', ssoController.discoverOrganization);
router.post('/initiate', ssoController.initiateSSO);
router.get('/callback', ssoController.handleSSOCallback);
router.post('/break-glass-login', ssoController.breakGlassLogin);

// Protected routes (authentication required) - MUST BE AFTER public routes
router.use(protect);
```

### Step 3: Check for Global Middleware
**File**: `src/index.js`

**Verify there's NO global protect middleware:**
```javascript
// ❌ WRONG - Don't do this:
// app.use('/api', protect);  // This would protect ALL /api routes

// ✅ CORRECT - Routes handle their own protection:
app.use('/api/sso', ssoRoutes);
app.use('/api/auth', authRoutes);
// etc.
```

### Step 4: Test After Fix
```bash
curl -X POST https://sbapp.onrender.com/api/sso/discover \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected Result**: 
- ✅ 200 OK (with SSO config) OR 404 (no SSO config)
- ❌ NOT 401 Unauthorized

## Why This Matters
The subscription middleware uses `req.path` which is relative to the router mount point. Since SSO routes are mounted at `/api/sso`, `req.path` for `/api/sso/discover` is `/discover`, not `/sso/discover`. This causes the middleware to not recognize it as a public route.

## Deployment Checklist
- [ ] Fix `subscriptionMiddleware.js` (line 15-16)
- [ ] Verify `ssoRoutes.js` route order is correct
- [ ] Check `index.js` for global protect middleware
- [ ] Deploy to backend
- [ ] Test endpoint with curl
- [ ] Verify mobile app works

## Mobile App Status
✅ Mobile app is ready and will work automatically once backend is fixed.

