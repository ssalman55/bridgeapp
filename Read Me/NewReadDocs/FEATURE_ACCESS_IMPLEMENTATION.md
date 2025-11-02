# Feature Access Control Implementation Guide

## Overview

This document explains how to implement plan-based feature gating in Staff Bridge. The system ensures that users can only access features included in their subscription plan (Basic, Professional, or Enterprise).

## Current Status

✅ **Frontend Changes**: COMPLETE - Pricing pages updated with feature lists
⚠️ **Backend Implementation**: NEEDS TO BE APPLIED - Middleware created but needs to be integrated into routes

## Architecture

### Middleware: `featureAccessMiddleware.js`

The middleware provides:
- `featureAccess(featureName)` - Blocks access if plan doesn't include feature
- `addFeatureInfo(req, res, next)` - Adds feature info to request (non-blocking)
- `hasFeatureAccess(plan, feature)` - Helper to check feature access
- `getPlanFeatures(plan)` - Get all features for a plan

### Feature Mapping

**Basic Plan Features:**
- staff_directory, staff_profiles
- leave_management
- basic_attendance (manual only)
- document_storage_basic (1 GB)
- bulletin_board, calendar
- basic_reports (5 templates)
- email_support
- rbac_standard
- audit_trail_30days

**Professional Plan Features:**
- All Basic features +
- geofencing_attendance
- payroll_processing
- expense_management
- asset_management
- performance_evaluations
- training_management
- onboarding_workflows
- custom_report_builder
- advanced_analytics
- priority_support
- phone_support
- rbac_advanced
- audit_trail_1year
- document_storage_10gb

**Enterprise Plan Features:**
- All Professional features +
- sso_scim
- api_access
- webhooks
- custom_integrations
- microsoft_teams
- unlimited_storage
- unlimited_templates
- advanced_security
- data_residency
- dedicated_account_manager
- support_24_7
- on_premise_deployment
- custom_workflows
- advanced_bi
- onboarding_migration
- audit_trail_unlimited

## Implementation Steps

### Step 1: Apply to Payroll Routes

**File:** `backend/src/routes/payrollRoutes.js`

```javascript
const { featureAccess } = require('../middleware/featureAccessMiddleware');

// Apply feature access check to payroll routes
router.use(checkSubscriptionStatus);
router.use(featureAccess('payroll_processing')); // Add this line

// Rest of routes remain the same
router.post('/generate', authenticateToken, permissions('Payroll', 'full', 'Payroll Management'), timeout(300000), payrollController.generatePayroll);
// ...
```

### Step 2: Apply to Expense Routes

**File:** `backend/src/routes/expenseClaimRoutes.js`

```javascript
const { featureAccess } = require('../middleware/featureAccessMiddleware');

router.use(checkSubscriptionStatus);
router.use(featureAccess('expense_management')); // Add this line

// Rest of routes remain the same
```

### Step 3: Apply to Geofencing Attendance

**File:** `backend/src/controllers/attendanceController.js` (or routes)

Check if geofencing is enabled and verify plan access:

```javascript
const { featureAccess } = require('../middleware/featureAccessMiddleware');

// In routes file:
router.post('/checkin', 
  authenticateToken, 
  featureAccess('geofencing_attendance'), // For geofencing check-in
  attendanceController.checkIn
);
```

**Note:** Basic plan should allow manual attendance without geofencing. Update the check-in logic:

```javascript
// In attendanceController.js checkIn function:
if (geofenceSettings?.isEnabled) {
  // Check if organization has geofencing feature
  const organization = await Organization.findById(req.user.organization);
  const plan = organization?.plan || 'basic';
  
  if (plan === 'basic') {
    return res.status(403).json({
      message: 'Geofencing is not available in the Basic plan. Please upgrade to Professional or Enterprise.',
      code: 'FEATURE_NOT_AVAILABLE'
    });
  }
  
  // Continue with geofencing logic...
}
```

### Step 4: Apply to Asset Management Routes

Find asset routes and add:

```javascript
const { featureAccess } = require('../middleware/featureAccessMiddleware');
router.use(featureAccess('asset_management'));
```

### Step 5: Apply to Performance Evaluation Routes

Find performance/training routes and add:

```javascript
router.use(featureAccess('performance_evaluations'));
router.use(featureAccess('training_management'));
```

### Step 6: Apply to Onboarding Routes

```javascript
router.use(featureAccess('onboarding_workflows'));
```

### Step 7: Apply to API/Webhooks Routes (Enterprise Only)

```javascript
router.use(featureAccess('api_access'));
// or for webhooks:
router.use(featureAccess('webhooks'));
```

### Step 8: Apply to SSO Routes (Enterprise Only)

```javascript
router.use(featureAccess('sso_scim'));
```

## Frontend Implementation

### Check Feature Access in Frontend Components

**Create:** `frontend/src/utils/featureAccess.ts`

```typescript
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';

export const useFeatureAccess = () => {
  const { user } = useAuth();
  const { subscriptionStatus } = useSubscriptionStatus();

  const hasFeature = (feature: string): boolean => {
    if (!subscriptionStatus?.plan) return false;
    
    const plan = subscriptionStatus.plan.toLowerCase();
    const features = getPlanFeatures(plan);
    return features.includes(feature);
  };

  return { hasFeature, plan: subscriptionStatus?.plan };
};

function getPlanFeatures(plan: string): string[] {
  const basic = ['staff_directory', 'staff_profiles', 'leave_management', /* ... */];
  const professional = [...basic, 'geofencing_attendance', 'payroll_processing', /* ... */];
  const enterprise = [...professional, 'sso_scim', 'api_access', /* ... */];
  
  if (plan === 'basic') return basic;
  if (plan === 'professional') return professional;
  if (plan === 'enterprise') return enterprise;
  return [];
}
```

**Usage in Components:**

```typescript
import { useFeatureAccess } from '../utils/featureAccess';

const MyComponent = () => {
  const { hasFeature, plan } = useFeatureAccess();

  return (
    <div>
      {hasFeature('payroll_processing') ? (
        <Link to="/payroll">Payroll Management</Link>
      ) : (
        <div>
          Payroll is not available in {plan} plan.
          <Link to="/billing">Upgrade to Professional</Link>
        </div>
      )}
    </div>
  );
};
```

### Hide/Show Menu Items Based on Plan

**File:** `frontend/src/components/Layout.tsx`

```typescript
const { hasFeature } = useFeatureAccess();

// Hide payroll menu if not available
{hasFeature('payroll_processing') && (
  <NavLink to="/payroll">Payroll</NavLink>
)}

// Hide expenses menu if not available
{hasFeature('expense_management') && (
  <NavLink to="/expenses">Expenses</NavLink>
)}
```

## Error Handling

When a user tries to access a feature they don't have:

**Backend Response:**
```json
{
  "success": false,
  "message": "This feature is not available in the Basic plan. Please upgrade to access this feature.",
  "code": "FEATURE_NOT_AVAILABLE",
  "requiredPlan": "professional",
  "currentPlan": "basic"
}
```

**Frontend Handling:**

```typescript
try {
  const response = await api.get('/api/payroll');
} catch (error) {
  if (error.response?.data?.code === 'FEATURE_NOT_AVAILABLE') {
    toast.error(error.response.data.message);
    navigate('/billing');
  }
}
```

## Testing Checklist

- [ ] Basic plan user cannot access payroll routes
- [ ] Basic plan user cannot access expense routes
- [ ] Basic plan user cannot use geofencing (manual attendance works)
- [ ] Professional plan user can access all Professional features
- [ ] Professional plan user cannot access Enterprise-only features (SSO, API)
- [ ] Enterprise plan user can access all features
- [ ] Frontend correctly hides menu items for unavailable features
- [ ] Error messages are user-friendly and include upgrade links
- [ ] Super admin bypasses all checks

## Migration Notes

1. **Existing Users**: Organizations already on a plan will maintain access until their subscription is checked
2. **Trial Users**: During trial, consider allowing access to Professional features for evaluation
3. **Downgrades**: If a user downgrades, they lose access immediately (handle gracefully)
4. **Grace Period**: Consider a 7-day grace period after downgrade for data export

## Priority Implementation Order

1. **High Priority** (Revenue Impact):
   - Payroll Processing (Professional+)
   - Expense Management (Professional+)
   - Geofencing (Professional+)

2. **Medium Priority**:
   - Asset Management (Professional+)
   - Performance Evaluations (Professional+)
   - Training Management (Professional+)

3. **Low Priority** (Nice to Have):
   - Onboarding Workflows (Professional+, limit templates)
   - Custom Report Builder (Professional+)
   - API Access (Enterprise)

## Support & Debugging

**Check Feature Access:**
```javascript
// In backend controller
console.log('Organization plan:', req.organizationPlan);
console.log('Available features:', req.organizationFeatures);
console.log('Has payroll:', req.organizationFeatures.includes('payroll_processing'));
```

**Test Feature Access:**
```bash
# Test with Basic plan
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/payroll

# Should return 403 with FEATURE_NOT_AVAILABLE
```

## Next Steps

1. Apply `featureAccess` middleware to all protected routes
2. Update frontend to check feature access before showing menu items
3. Add feature access checks to API calls
4. Test thoroughly with different plan types
5. Update documentation for each feature

