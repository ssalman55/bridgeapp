const Role = require('../models/Role');

// Usage: permissions('Payroll', 'view', 'Payroll Management')
function permissions(module, requiredLevel = 'view', page = null) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    // "admin" always allowed
    if (req.user.role === 'admin') return next();

    // Try to find the role in the roles collection (works for both built-in and custom roles)
    const roleDoc = await Role.findOne({ name: req.user.role });

    if (roleDoc) {
      let perm = 'none';
      // Support both Map and plain object
      let modulePerm = roleDoc.permissions.get ? roleDoc.permissions.get(module) : roleDoc.permissions[module];
      if (page && modulePerm && typeof modulePerm === 'object') {
        perm = modulePerm.get ? modulePerm.get(page) : modulePerm[page] || 'none';
      } else if (typeof modulePerm === 'string') {
        perm = modulePerm;
      }
      const levels = ['none', 'view', 'full'];
      if (levels.indexOf(perm) >= levels.indexOf(requiredLevel)) {
        return next();
      } else {
        return res.status(403).json({ message: `Insufficient permission for ${module}${page ? ' - ' + page : ''}` });
      }
    } else {
      // Fallback for legacy built-in roles (if not found in roles collection)
      if ([
        'staff',
        'academic_admin',
        'inventory_manager'
      ].includes(req.user.role)) {
        // Legacy: allow all (as per previous logic)
        return next();
      }
      // Otherwise, deny
      return res.status(403).json({ message: 'Role not found or no permissions' });
    }
  };
}

module.exports = permissions; 