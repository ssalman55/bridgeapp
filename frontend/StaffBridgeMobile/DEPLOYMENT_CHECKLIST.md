# Deployment Checklist - SSO Discovery Fix

## Critical Changes Required

### 1. ✅ `src/middleware/subscriptionMiddleware.js` (Line 18)
**Change:**
```javascript
// OLD (WRONG):
if (authRoutes.some(route => req.path.startsWith(route))) {

// NEW (CORRECT):
if (authRoutes.some(route => req.originalUrl.includes(route))) {
```

### 2. ✅ `src/index.js` (Lines 143-168)
**Add global subscription middleware with SSO in skipRoutes:**
```javascript
const { checkSubscriptionStatus } = require('./middleware/subscriptionMiddleware');

// Apply global subscription middleware to all API routes except auth, billing, and SSO
app.use('/api', (req, res, next) => {
  const skipRoutes = [
    '/auth',
    '/stripe', 
    '/payments',
    '/organization/subscription-status',
    '/enhanced-payroll',
    '/contact-sales',
    '/health',
    '/sso' // CRITICAL: Must be included!
  ];
  
  if (skipRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  return checkSubscriptionStatus(req, res, next);
});
```

### 3. ✅ `src/index.js` (Line 175)
**Move SSO routes EARLY (before catch-all routes):**
```javascript
// IMPORTANT: Register SSO routes EARLY to avoid catch-all route conflicts
app.use('/api/sso', ssoRoutes);

// Then register other routes...
app.use('/api/auth', authRoutes);
// ... other routes ...
```

### 4. ✅ `src/routes/ssoRoutes.js` 
**Verify route order:**
```javascript
// Public routes MUST be BEFORE router.use(protect)
router.post('/discover', ssoController.discoverOrganization);
router.post('/initiate', ssoController.initiateSSO);
router.get('/callback', ssoController.handleSSOCallback);
router.post('/break-glass-login', ssoController.breakGlassLogin);

// Protected routes MUST be AFTER router.use(protect)
router.use(protect);
```

## Verification Steps

After deployment, check backend logs for:

1. **Subscription middleware skipping:**
   ```
   [Subscription Middleware] Path: /sso/discover, Method: POST
   [Subscription Middleware] Skipping subscription check for: /sso/discover
   ```

2. **SSO route debug logs:**
   ```
   [INDEX] SSO route matched: POST /api/sso/discover
   === SSO ROUTE REQUEST ===
   SSO Route method: POST
   SSO Route path: /discover
   ```

3. **Controller logs:**
   ```
   === SSO DISCOVERY REQUEST ===
   Email: sahmad@acsdoha.school
   ```

If you see logs 1 and 2 but NOT 3, the route is being matched but the controller isn't being called.
If you don't see log 2, the route isn't being matched at all.

## Expected Behavior After Fix

- ✅ Subscription middleware skips SSO routes
- ✅ Request reaches SSO routes
- ✅ Debug logs appear
- ✅ Controller executes
- ✅ Returns 200/404 (NOT 401)

