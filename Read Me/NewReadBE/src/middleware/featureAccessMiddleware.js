const Organization = require('../models/Organization');

/**
 * Feature mapping by plan
 * Features are organized by module/functionality
 */
const BASIC_FEATURES = [
  'staff_directory',
  'staff_profiles',
  'leave_management',
  'basic_attendance',
  'document_storage_basic',
  'bulletin_board',
  'calendar',
  'basic_reports',
  'email_support',
  'rbac_standard',
  'audit_trail_30days',
  'custom_integrations',
];

const PROFESSIONAL_FEATURES = [
  ...BASIC_FEATURES,
  'geofencing_attendance',
  'payroll_processing',
  'expense_management',
  'asset_management',
  'performance_evaluations',
  'training_management',
  'onboarding_workflows',
  'task_management',
  'events_management',
  'custom_report_builder',
  'advanced_analytics',
  'priority_support',
  'phone_support',
  'rbac_advanced',
  'audit_trail_1year',
  'document_storage_10gb',
];

const ENTERPRISE_FEATURES = [
  ...PROFESSIONAL_FEATURES,
  'sso_scim',
  'api_access',
  'webhooks',
  'microsoft_teams',
  'unlimited_storage',
  'unlimited_templates',
  'advanced_security',
  'data_residency',
  'dedicated_account_manager',
  'support_24_7',
  'on_premise_deployment',
  'custom_workflows',
  'advanced_bi',
  'onboarding_migration',
  'audit_trail_unlimited',
];

const FEATURES_BY_PLAN = {
  basic: BASIC_FEATURES,
  professional: PROFESSIONAL_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

// Feature to plan mapping (for error messages)
const FEATURE_TO_PLAN_MAP = {
  'geofencing_attendance': 'professional',
  'payroll_processing': 'professional',
  'expense_management': 'professional',
  'asset_management': 'professional',
  'performance_evaluations': 'professional',
  'training_management': 'professional',
  'onboarding_workflows': 'professional',
  'task_management': 'professional',
  'events_management': 'professional',
  'custom_report_builder': 'professional',
  'advanced_analytics': 'professional',
  'priority_support': 'professional',
  'phone_support': 'professional',
  'rbac_advanced': 'professional',
  'sso_scim': 'enterprise',
  'api_access': 'enterprise',
  'webhooks': 'enterprise',
  'microsoft_teams': 'enterprise',
  'unlimited_storage': 'enterprise',
  'unlimited_templates': 'enterprise',
  'advanced_security': 'enterprise',
  'data_residency': 'enterprise',
  'dedicated_account_manager': 'enterprise',
  'support_24_7': 'enterprise',
  'on_premise_deployment': 'enterprise',
  'custom_workflows': 'enterprise',
  'advanced_bi': 'enterprise',
  'onboarding_migration': 'enterprise',
};

/**
 * Get features available for a plan
 */
function getPlanFeatures(plan) {
  return FEATURES_BY_PLAN[plan] || BASIC_FEATURES;
}

/**
 * Check if a plan has access to a specific feature
 */
function hasFeatureAccess(plan, feature) {
  const planFeatures = getPlanFeatures(plan);
  return planFeatures.includes(feature);
}

/**
 * Middleware to check feature access based on organization's plan
 * Usage: featureAccess('geofencing_attendance')
 */
function featureAccess(requiredFeature) {
  return async (req, res, next) => {
    try {
      // Skip check for super admin
      if (req.user && req.user.email === 'admin@sb.com') {
        return next();
      }

      // Skip if user is not authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Get organization ID from user
      const organizationId = req.user?.organization?._id;
      
      if (!organizationId) {
        return res.status(403).json({
          success: false,
          message: 'Organization not found',
          code: 'NO_ORGANIZATION'
        });
      }

      // Fetch organization
      const organization = await Organization.findById(organizationId);
      
      if (!organization) {
        return res.status(403).json({
          success: false,
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      // Get organization's plan
      const plan = organization.plan || 'basic';

      // Check feature access
      if (!hasFeatureAccess(plan, requiredFeature)) {
        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
        return res.status(403).json({
          success: false,
          message: `This feature is not available in the ${planName} plan. Please upgrade to access this feature.`,
          code: 'FEATURE_NOT_AVAILABLE',
          requiredPlan: getRequiredPlan(requiredFeature),
          currentPlan: plan
        });
      }

      // Attach plan info to request for use in controllers
      req.organizationPlan = plan;
      req.organizationFeatures = getPlanFeatures(plan);

      next();
    } catch (error) {
      console.error('Feature access middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        code: 'FEATURE_CHECK_ERROR'
      });
    }
  };
}

/**
 * Get the minimum plan required for a feature
 */
function getRequiredPlan(feature) {
  // Check if it's in basic features
  if (BASIC_FEATURES.includes(feature)) return 'basic';
  
  // Check feature to plan map
  if (FEATURE_TO_PLAN_MAP[feature]) {
    return FEATURE_TO_PLAN_MAP[feature];
  }
  
  // Default to enterprise for unknown features
  return 'enterprise';
}

/**
 * Optional middleware that adds feature info to request without blocking
 */
async function addFeatureInfo(req, res, next) {
  try {
    if (!req.user || !req.user.organization?._id) {
      req.featureInfo = { plan: null, features: [] };
      return next();
    }

    const organization = await Organization.findById(req.user.organization._id);
    if (!organization) {
      req.featureInfo = { plan: null, features: [] };
      return next();
    }

    const plan = organization.plan || 'basic';
    req.featureInfo = {
      plan,
      features: getPlanFeatures(plan),
      hasFeature: (feature) => hasFeatureAccess(plan, feature)
    };

    next();
  } catch (error) {
    console.error('Feature info middleware error:', error);
    req.featureInfo = { plan: null, features: [] };
    next();
  }
}

module.exports = {
  featureAccess,
  addFeatureInfo,
  hasFeatureAccess,
  getPlanFeatures,
  getRequiredPlan,
  FEATURES_BY_PLAN
};

