const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');
const Role = require('../models/Role');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all role routes
router.use(checkSubscriptionStatus);

router.post('/roles', permissions('Admin', 'full', 'Role Management'), roleController.createRole);
router.get('/roles', (req, res, next) => {
  // Allow admin users to access this endpoint regardless of specific permissions
  if (req.user.role && req.user.role.toLowerCase() === 'admin') {
    return next();
  }
  // For non-admin users, check Role Management permissions
  return permissions('Admin', 'view', 'Role Management')(req, res, next);
}, roleController.getRoles);
router.put('/roles/:id', permissions('Admin', 'full', 'Role Management'), roleController.updateRole);
router.delete('/roles/:id', permissions('Admin', 'full', 'Role Management'), roleController.deleteRole);
router.get('/roles/super-admin-status', (req, res, next) => {
  // Allow admin users to access this endpoint regardless of specific permissions
  if (req.user.role && req.user.role.toLowerCase() === 'admin') {
    return next();
  }
  // For non-admin users, check Role Management permissions
  return permissions('Admin', 'view', 'Role Management')(req, res, next);
}, roleController.getSuperAdminStatus);
router.post('/roles/promote-super-admin', permissions('Admin', 'full', 'Role Management'), roleController.promoteToSuperAdmin);

router.get('/roles/my-role', async (req, res) => {
  try {
    const roleName = req.user.role ? req.user.role.toLowerCase() : '';
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    const role = await Role.findOne({ 
      name: new RegExp('^' + roleName + '$', 'i'),
      organization: organizationId 
    });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    
    // Convert Map permissions to plain object for frontend
    let permissions = {};
    if (role.permissions) {
      if (role.permissions instanceof Map) {
        // Convert Map to plain object
        for (const [module, modulePerms] of role.permissions.entries()) {
          if (modulePerms instanceof Map) {
            permissions[module] = {};
            for (const [page, perm] of modulePerms.entries()) {
              permissions[module][page] = perm;
            }
          } else {
            permissions[module] = modulePerms;
          }
        }
      } else {
        // Already a plain object
        permissions = role.permissions;
      }
    }
    
    res.json({
      _id: role._id,
      name: role.name,
      organization: role.organization,
      isDefault: role.isDefault,
      permissions: permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch role', error: err.message });
  }
});

module.exports = router; 