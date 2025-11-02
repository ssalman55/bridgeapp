const Role = require('../models/Role');

// Usage: permissions('Salary & Payroll', 'view', 'Salary Management')
function permissions(module, requiredLevel = 'view', page = null) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    // "admin" always allowed (case-insensitive)
    if (req.user.role && req.user.role.toLowerCase() === 'admin') {
      return next();
    }

    // Try to find the role in the roles collection for this organization
    // Use case-insensitive matching to handle role name variations
    let roleDoc = null;
    
    if (req.user.role) {
      // Handle organization field which might be populated (object) or just an ObjectId
      const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
        ? req.user.organization._id
        : req.user.organization;
      
      // First try case-insensitive exact match
      roleDoc = await Role.findOne({ 
        name: new RegExp('^' + req.user.role + '$', 'i'),
        organization: organizationId 
      });
      
      // If still not found, try with lowercase
      if (!roleDoc) {
        roleDoc = await Role.findOne({ 
          name: new RegExp('^' + req.user.role.toLowerCase() + '$', 'i'),
          organization: organizationId 
        });
      }
      
      // If still not found, try with uppercase
      if (!roleDoc) {
        roleDoc = await Role.findOne({ 
          name: new RegExp('^' + req.user.role.toUpperCase() + '$', 'i'),
          organization: organizationId 
        });
      }
    }

    if (roleDoc) {
      let perm = 'none';
      
      // Check if permissions exists and is not null/undefined
      if (roleDoc.permissions) {
        // Handle both Map and plain object permissions
        let modulePerm;
        if (roleDoc.permissions instanceof Map) {
          modulePerm = roleDoc.permissions.get(module);
        } else if (typeof roleDoc.permissions === 'object') {
          modulePerm = roleDoc.permissions[module];
        }
        
        if (page && modulePerm && typeof modulePerm === 'object') {
          if (modulePerm instanceof Map) {
            perm = modulePerm.get(page) || 'none';
          } else {
            perm = modulePerm[page] || 'none';
          }
        } else if (typeof modulePerm === 'string') {
          perm = modulePerm;
        } else if (!page && modulePerm && typeof modulePerm === 'object') {
          // If no page specified but module has page-level permissions, 
          // check if any page has the required level
          const levels = ['none', 'view', 'full'];
          const requiredIndex = levels.indexOf(requiredLevel);
          
          if (modulePerm instanceof Map) {
            for (let [pageName, pagePerm] of modulePerm) {
              if (levels.indexOf(pagePerm) >= requiredIndex) {
                perm = pagePerm;
                break;
              }
            }
          } else {
            for (let pageName in modulePerm) {
              if (levels.indexOf(modulePerm[pageName]) >= requiredIndex) {
                perm = modulePerm[pageName];
                break;
              }
            }
          }
        }
      }
      
      const levels = ['none', 'view', 'full'];
      if (levels.indexOf(perm) >= levels.indexOf(requiredLevel)) {
        return next();
      } else {
        console.log(`Permission denied: User ${req.user.email} (role: ${req.user.role}) needs ${requiredLevel} for ${module}${page ? ' - ' + page : ''}, has ${perm}`);
        return res.status(403).json({ message: `Insufficient permission for ${module}${page ? ' - ' + page : ''}` });
      }
    } else {
      // Fallback for legacy built-in roles (if not found in roles collection)
      if ([
        'staff',
        'academic_admin',
        'inventory_manager'
      ].includes(req.user.role.toLowerCase())) {
        // Legacy: allow all (as per previous logic)
        return next();
      }
      // Otherwise, deny
      const orgIdForLog = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
        ? req.user.organization._id
        : req.user.organization;
      console.log(`Role not found: User ${req.user.email} (role: ${req.user.role}) not found in roles collection for org ${orgIdForLog}`);
      return res.status(403).json({ message: 'Role not found or no permissions' });
    }
  };
}

module.exports = permissions; 