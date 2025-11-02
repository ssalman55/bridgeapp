# Microsoft Teams Integration - Deployment Checklist

## Pre-Deployment Review

### Code Quality
- [x] No TypeScript errors in frontend
- [x] No linting errors detected
- [x] All new files created
- [x] All modified files updated
- [x] Error handling implemented
- [x] User feedback (toasts) added

### File Summary

**New Backend Files:**
- [ ] `backend/src/models/SSOConfiguration.js` - Created ✅

**New Frontend Files:**
- [ ] `frontend/src/pages/TeamsIntegrationSettings.tsx` - Created ✅
- [ ] `frontend/src/components/TeamsCallButton.tsx` - Created ✅
- [ ] `frontend/src/utils/teamsIntegration.ts` - Created ✅

**Modified Backend Files:**
- [ ] `backend/src/controllers/ssoController.js` - Updated ✅
- [ ] `backend/src/routes/ssoRoutes.js` - Updated ✅

**Modified Frontend Files:**
- [ ] `frontend/src/App.tsx` - Updated ✅
- [ ] `frontend/src/components/Layout.tsx` - Updated ✅
- [ ] `frontend/src/pages/StaffProfiles.tsx` - Updated ✅

---

## Backend Deployment

### Step 1: Code Review
- [ ] Review all changes in `backend/src/`
- [ ] Verify no breaking changes to existing SSO routes
- [ ] Check database migration (if needed)

### Step 2: Database Preparation
```bash
# SSOConfiguration model is created automatically by Mongoose
# No manual migration required - MongoDB will handle schema creation
```
- [ ] No database migrations needed ✅

### Step 3: Environment Variables
- [ ] Verify `.env` has all required variables
- [ ] No new environment variables required ✅
- [ ] Existing `MONGODB_URI` is configured

### Step 4: Deploy Backend
```bash
# On your backend server (Render/Heroku/VPS)
cd backend
git pull  # or push your latest code
npm install  # if package.json changed (it didn't)
npm start  # or your deployment command
```
- [ ] Backend code pushed to repository
- [ ] Backend deployed successfully
- [ ] Backend server is running
- [ ] No errors in backend logs

### Step 5: Test Backend Endpoints
```bash
# Test with curl or Postman
GET /api/sso/teams/integration-status
# Should return: { success: true, data: { enabled: false, ... } }
```
- [ ] `GET /sso/teams/integration-status` responds correctly
- [ ] `GET /sso/config` returns configuration
- [ ] `PUT /sso/config` accepts updates (admin only)
- [ ] `POST /sso/config/test-azure-connection` works

---

## Frontend Deployment

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```
- [ ] All dependencies installed
- [ ] No installation errors

### Step 2: Build Frontend
```bash
npm run build
```
Expected output: `dist/` folder with optimized production build

- [ ] Build succeeds without errors
- [ ] `dist/` folder created
- [ ] All assets properly bundled
- [ ] Source maps generated (optional)

### Step 3: Deploy to Hosting
Choose your deployment platform:

#### Option A: Vercel
```bash
npm install -g vercel
vercel
```
- [ ] Connected to Vercel account
- [ ] Project configured correctly
- [ ] Build setting: `npm run build`
- [ ] Output directory: `dist`
- [ ] Deployment successful

#### Option B: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir dist
```
- [ ] Netlify CLI installed
- [ ] Site deployed successfully
- [ ] Build logs checked for errors

#### Option C: Self-Hosted
```bash
# Copy dist folder to your web server
scp -r dist/* user@server:/var/www/staffbridge/
# or use FTP/Git-based deployment
```
- [ ] `dist/` contents copied to web root
- [ ] Web server configured to serve index.html
- [ ] CORS headers configured if needed

### Step 4: Verify Deployment
- [ ] Application loads without errors
- [ ] All routes accessible
- [ ] Admin menu visible
- [ ] "Teams Integration" link appears in Admin menu

---

## Post-Deployment Testing

### For Admins
1. [ ] Log in as Admin
2. [ ] Go to **Admin Menu → Teams Integration Settings**
3. [ ] Page loads successfully
4. [ ] UI renders correctly
5. [ ] Toggle buttons work (on/off)
6. [ ] Input fields editable
7. [ ] "Test Connection" button clickable

### For Users
1. [ ] Log in as regular staff user
2. [ ] Go to **People → Staff Profiles**
3. [ ] Staff list loads
4. [ ] Teams button appears (if admin enabled it)
5. [ ] Teams button clickable
6. [ ] Clicking Teams button opens Teams app/web

### Browser Testing
- [ ] Chrome (latest)
- [ ] Microsoft Edge (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

---

## Feature Verification

### Teams Integration Settings (Admin Only)

#### Azure Entra ID Section
- [ ] Enable toggle works
- [ ] Tenant ID field accepts input
- [ ] Client ID field accepts input
- [ ] Client Secret field accepts input
- [ ] Show/hide password toggle works
- [ ] Test Connection button clickable
- [ ] Save button works
- [ ] Configuration persists after refresh

#### Teams Calling Section
- [ ] Enable toggle works
- [ ] Can only enable if Azure enabled
- [ ] Call mode options display (Deep Link, Teams App, Teams Web)
- [ ] Can select different modes
- [ ] Selection saves correctly
- [ ] Help text appears for each mode

### Staff Profiles Integration

#### Table View
- [ ] Eye icon appears
- [ ] Teams button appears next to eye icon
- [ ] Teams button only shows if integration enabled
- [ ] Clicking eye opens profile modal
- [ ] Clicking Teams button initiates call

#### Card View
- [ ] Card layout displays correctly
- [ ] Eye button appears
- [ ] Teams button appears
- [ ] Both buttons functional

### Teams Call Flow
- [ ] Click Teams button
- [ ] Teams app/web opens
- [ ] Call initiates with staff member email
- [ ] Loading state shows during action
- [ ] Toast notification appears (success)
- [ ] Error handling works (invalid email)

---

## Rollback Plan (If Issues Occur)

### Quick Rollback
```bash
# Frontend - Deploy previous version
git revert HEAD
npm run build
# Deploy dist/ to hosting

# Backend - Revert database changes (none required)
git revert HEAD
npm start
```

### Steps
1. [ ] Identify the issue
2. [ ] Document error in logs
3. [ ] Decide to rollback or fix
4. [ ] If rollback: revert latest commits
5. [ ] Test previous version
6. [ ] Notify team of status

---

## Performance Monitoring

### Frontend Metrics
- [ ] Page load time: < 3s
- [ ] Teams button render: < 1s
- [ ] Settings page load: < 2s
- [ ] No console errors

### Backend Metrics
- [ ] `/sso/config` response time: < 500ms
- [ ] `/sso/teams/integration-status` response time: < 300ms
- [ ] `PUT /sso/config` response time: < 1000ms
- [ ] No database errors

### Logging
- [ ] Check backend logs for errors
- [ ] Check frontend console for errors
- [ ] Monitor error tracking (Sentry if configured)
- [ ] Review API logs for 404/500 errors

---

## Security Checklist

- [ ] Client Secret is never logged
- [ ] API endpoints require authentication
- [ ] Admin endpoints require admin role
- [ ] HTTPS enabled on production
- [ ] CORS properly configured
- [ ] Rate limiting enabled (if needed)
- [ ] Input validation working
- [ ] No sensitive data in frontend code
- [ ] Environment variables not exposed

---

## Documentation

- [ ] `TEAMS_INTEGRATION_GUIDE.md` available for admins
- [ ] `TEAMS_INTEGRATION_GUIDE.md` available for users
- [ ] `BUILD_INSTRUCTIONS.md` provided to team
- [ ] `TEAMS_DEPLOYMENT_CHECKLIST.md` completed
- [ ] Code comments added where needed
- [ ] README updated (if applicable)

---

## Team Communication

### Before Deployment
- [ ] Notify IT team of deployment window
- [ ] Schedule announcement for users
- [ ] Prepare support documentation
- [ ] Brief support team on new feature

### During Deployment
- [ ] Monitor deployment logs
- [ ] Be available for troubleshooting
- [ ] Test immediately after deployment
- [ ] Watch for error reports

### After Deployment
- [ ] Send announcement to users
- [ ] Provide link to user guide
- [ ] Monitor for issues (24-48 hours)
- [ ] Gather feedback
- [ ] Document any issues for future reference

---

## Sign-Off

### Development Team
- [ ] Code reviewed and approved
- [ ] All tests passed
- [ ] Deployment ready
- Signed: _________________ Date: _______

### QA Team
- [ ] Feature tested end-to-end
- [ ] Cross-browser testing complete
- [ ] Mobile testing complete
- Signed: _________________ Date: _______

### Operations Team
- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Rollback plan documented
- Signed: _________________ Date: _______

---

## Deployment Summary

- **Feature**: Microsoft Teams Integration
- **Release Date**: October 24, 2024
- **Files Modified**: 6
- **Files Created**: 4
- **Breaking Changes**: None ✅
- **Database Changes**: None ✅
- **Rollback Required**: No ✅

---

## Post-Deployment Follow-Up (Next 7 Days)

- [ ] Monitor error logs daily
- [ ] Check user feedback daily
- [ ] Verify no performance degradation
- [ ] Test Teams calling with real users
- [ ] Gather usage metrics
- [ ] Document lessons learned
- [ ] Plan any necessary improvements

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Verified By**: _____________
**Status**: ⏳ Pending → 🚀 Deployed → ✅ Verified


