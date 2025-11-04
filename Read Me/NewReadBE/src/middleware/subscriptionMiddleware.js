const Organization = require('../models/Organization');

/**
 * Middleware to check if organization's subscription is active
 * Blocks access to protected endpoints for expired subscriptions
 */
const checkSubscriptionStatus = async (req, res, next) => {
  try {
    // Skip check for super admin
    if (req.user && req.user.email === 'admin@sb.com') {
      return next();
    }

    // Skip check for authentication and SSO routes
    // Use req.originalUrl to check full path (includes mount point like /api/sso/discover)
    // This is necessary because req.path is relative to router mount point
    const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/sso/discover', '/sso/initiate', '/sso/callback', '/sso/break-glass-login'];
    if (authRoutes.some(route => req.originalUrl.includes(route))) {
      return next();
    }

    // Skip check for organization subscription status endpoint
    if (req.path.startsWith('/organization/subscription-status')) {
      return next();
    }

    // Skip check for billing/payment related endpoints
    const billingRoutes = ['/stripe', '/payments', '/billing'];
    if (billingRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Skip check if user is not authenticated (let auth middleware handle this)
    if (!req.user) {
      return next();
    }

    // Get organization ID from user
    const organizationId = req.user?.organization?._id;
    
    if (!organizationId) {
      console.log('Subscription middleware: No organization ID found for user', req.user.email);
      return next(); // Allow access but log the issue
    }

    // Fetch organization subscription status
    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      console.log('Subscription middleware: Organization not found for ID', organizationId);
      return next(); // Allow access but log the issue
    }

    const now = new Date();
    const trialEndDate = organization.trialEndDate;
    const subscriptionEndDate = organization.subscriptionEndDate;
    
    // Check if organization is suspended
    if (organization.isSuspended) {
      console.log(`Unauthorized access attempt - Suspended organization for user: ${req.user.email}, organization: ${organization.name} (${organization._id}), path: ${req.path}`);
      
      return res.status(403).json({
        success: false,
        message: 'Your organization subscription has been paused. Please contact support for assistance.',
        code: 'ORGANIZATION_SUSPENDED',
        requiresTokenCleanup: true
      });
    }

    // Check if subscription is expired and update status if needed
    let isExpired = false;
    let statusChanged = false;
    
    if (organization.subscriptionStatus === 'trial') {
      isExpired = trialEndDate && now > trialEndDate;
      if (isExpired && organization.subscriptionStatus !== 'expired') {
        organization.subscriptionStatus = 'expired';
        statusChanged = true;
      }
    } else if (organization.subscriptionStatus === 'active') {
      isExpired = subscriptionEndDate && now > subscriptionEndDate;
      if (isExpired && organization.subscriptionStatus !== 'expired') {
        organization.subscriptionStatus = 'expired';
        statusChanged = true;
      }
    } else if (organization.subscriptionStatus === 'paused') {
      isExpired = true; // Paused organizations are treated as expired
    } else {
      isExpired = true; // 'expired' status
    }

    // Save the updated status if it changed
    if (statusChanged) {
      await organization.save();
      console.log(`Subscription middleware: Updated organization ${organization.name} (${organization._id}) status to: expired`);
    }

    if (isExpired) {
      // Log unauthorized access attempt for auditing
      console.log(`Unauthorized access attempt - Expired subscription for user: ${req.user.email}, organization: ${organization.name} (${organization._id}), path: ${req.path}`);
      
      return res.status(403).json({
        success: false,
        message: 'Subscription has expired. Please update your billing information to continue.',
        code: 'SUBSCRIPTION_EXPIRED',
        requiresTokenCleanup: true
      });
    }

    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    // On error, allow access but log the issue
    next();
  }
};

/**
 * Optional middleware to check subscription status without blocking
 * Useful for endpoints that should work but show warnings
 */
const checkSubscriptionStatusOptional = async (req, res, next) => {
  try {
    // Skip check for super admin
    if (req.user && req.user.email === 'admin@sb.com') {
      req.subscriptionStatus = { isActive: true };
      return next();
    }

    const organizationId = req.user?.organization?._id;
    
    if (!organizationId) {
      req.subscriptionStatus = { isActive: false };
      return next();
    }

    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      req.subscriptionStatus = { isActive: false };
      return next();
    }

    const now = new Date();
    const trialEndDate = organization.trialEndDate;
    const subscriptionEndDate = organization.subscriptionEndDate;
    
    let isActive = false;
    
    if (organization.subscriptionStatus === 'trial') {
      isActive = !(trialEndDate && now > trialEndDate);
    } else if (organization.subscriptionStatus === 'active') {
      isActive = !(subscriptionEndDate && now > subscriptionEndDate);
    }

    req.subscriptionStatus = { 
      isActive,
      plan: organization.plan,
      status: organization.subscriptionStatus
    };

    next();
  } catch (error) {
    console.error('Optional subscription middleware error:', error);
    req.subscriptionStatus = { isActive: false };
    next();
  }
};

module.exports = {
  checkSubscriptionStatus,
  checkSubscriptionStatusOptional
}; 