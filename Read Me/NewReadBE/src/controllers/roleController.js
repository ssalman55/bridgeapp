const Role = require('../models/Role');

// Helper function to create default roles for an organization
const createDefaultRoles = async (organizationId) => {
  try {
    // Check if default roles already exist for this organization
    const existingAdminRole = await Role.findOne({ 
      name: { $regex: /^admin$/i }, 
      organization: organizationId 
    });
    const existingStaffRole = await Role.findOne({ 
      name: { $regex: /^staff$/i }, 
      organization: organizationId 
    });
    
    // Create Admin role if it doesn't exist
    if (!existingAdminRole) {
      try {
        const adminRole = new Role({
          name: 'admin',
          organization: organizationId,
          isDefault: true,
          permissions: new Map([
            ['Main', new Map([
              ['Dashboard', 'full'],
              ['Document Library', 'full'],
              ['Official Letters', 'full']
            ])],
            ['People', new Map([
              ['Create', 'full'],
              ['Profiles', 'full'],
              ['Staff Directory', 'full'],
              ['Documents', 'full'],
              ['Assign a Task', 'full'],
              ['View Tasks', 'full'],
              ['Give Recognition', 'full'],
              ['Recognition Approvals', 'full']
            ])],
            ['Communication', new Map([
              ['Bulletin Board', 'full'],
              ['Calendar', 'full']
            ])],
            ['Helpdesk', new Map([
              ['Dashboard', 'full'],
              ['All Tickets', 'full'],
              ['New Request', 'full'],
              ['My Requests', 'full'],
              ['Knowledge Base', 'full'],
              ['Categories', 'full'],
              ['Reports', 'full']
            ])],
            ['Operations', new Map([
              ['Events', 'full'],
              ['Create Event', 'full'],
              ['Request Event', 'full'],
              ['My Events', 'full'],
              ['Approvals', 'full'],
              ['Templates', 'full'],
              ['Calendar', 'full']
            ])],
            ['Attendance', new Map([
              ["Today's Presents", 'full'],
              ["Today's Absents", 'full'],
              ['Monthly Absents', 'full'],
              ['Attendance Tracker', 'full'],
              ['Leave Management', 'full'],
              ['Leave Tracker', 'full'],
              ['Upcoming Leaves', 'full']
            ])],
            ['Learning', new Map([
              ['Requests', 'full'],
              ['Approved', 'full'],
              ['Rejected', 'full'],
              ['Cost', 'full'],
              ['Evaluation', 'full']
            ])],
            ['Salary', new Map([
              ['Salary Management', 'full'],
              ['Bank Details', 'full'],
              ['Custom Report Builder', 'full']
            ])],
            ['Payroll', new Map([
              ['Payroll Management', 'full'],
              ['Payroll Journal', 'full'],
              ['Monthly Payroll Summary', 'full'],
              ['Yearly Payroll', 'full'],
              ['Payroll Audit Trail', 'full'],
              ['Generate Payroll File', 'full'],
              ['LWOP Management', 'full']
            ])],
            ['Expenses', new Map([
              ['Pending Claims', 'full'],
              ['Approved Claims', 'full'],
              ['Rejected Claims', 'full'],
              ['Monthly Expense', 'full'],
              ['Yearly Expense', 'full']
            ])],
            ['Assets', new Map([
              ['Create Items', 'full'],
              ['Assets Management', 'full'],
              ['Assets Summary', 'full'],
              ['Approved Assets', 'full'],
              ['Rejected Assets', 'full'],
              ['Assets Requests', 'full']
            ])],
            ['Onboarding', new Map([
              ['Dashboard', 'full'],
              ['Manage Templates', 'full'],
              ['New Onboarding', 'full'],
              ['Pipelines', 'full'],
              ['Manage Tasks', 'full']
            ])],
            ['Admin', new Map([
              ['Role Management', 'full'],
              ['System Variables', 'full'],
              ['Create Geofence', 'full'],
              ['Geofence Settings', 'full'],
              ['SSO Configuration', 'full'],
              ['Billing', 'full']
            ])]
          ])
        });
        await adminRole.save();
        console.log(`Admin role created for organization ${organizationId}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Admin role already exists for organization ${organizationId} (duplicate key error)`);
        } else {
          throw error;
        }
      }
    } else {
      // Update existing Admin role to have isDefault: true if it doesn't already
      if (!existingAdminRole.isDefault) {
        existingAdminRole.isDefault = true;
        await existingAdminRole.save();
        console.log(`Updated existing Admin role to be default for organization ${organizationId}`);
      }
    }

    // Create Staff role if it doesn't exist
    if (!existingStaffRole) {
      try {
        const staffRole = new Role({
          name: 'staff',
          organization: organizationId,
          isDefault: true,
          permissions: new Map([
            ['Main', new Map([
              ['Dashboard', 'view'],
              ['Official Letters', 'view']
            ])],
            ['People', new Map([
              ['Profiles', 'view'],
              ['Create', 'none'],
              ['Staff Directory', 'view']
            ])],
            ['Attendance', new Map([
              ["Today's Presents", 'view'],
              ["Today's Absents", 'view'],
              ['Monthly Absents', 'view'],
              ['Attendance Tracker', 'view'],
              ['Leave Management', 'view'],
              ['Leave Tracker', 'view'],
              ['Upcoming Leaves', 'view']
            ])],
            ['Communication', new Map([
              ['Bulletin Board', 'view'],
              ['Calendar', 'view']
            ])],
            ['Operations', new Map([
              ['Events', 'view'],
              ['Request Event', 'view'],
              ['My Events', 'view'],
              ['Templates', 'view']
            ])],
            ['Assets', new Map([
              ['Create Items', 'view'],
              ['Assets Management', 'view'],
              ['Assets Summary', 'view'],
              ['Assets Requests', 'view']
            ])],
            ['Learning', new Map([
              ['Requests', 'view'],
              ['Approved', 'view'],
              ['Rejected', 'view'],
              ['Cost', 'view'],
              ['Evaluation', 'view']
            ])],
            ['Salary', new Map([
              ['Salary Management', 'view'],
              ['Bank Details', 'view'],
              ['Custom Report Builder', 'view']
            ])],
            ['Expenses', new Map([
              ['Pending Claims', 'view'],
              ['Approved Claims', 'view'],
              ['Rejected Claims', 'view'],
              ['Monthly Expense', 'view'],
              ['Yearly Expense', 'view']
            ])],
            ['Admin', new Map([
              ['Role Management', 'none'],
              ['System Variables', 'none'],
              ['Create Geofence', 'none'],
              ['Geofence Settings', 'none'],
              ['SSO Configuration', 'none'],
              ['Billing', 'none']
            ])]
          ])
        });
        await staffRole.save();
        console.log(`Staff role created for organization ${organizationId}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Staff role already exists for organization ${organizationId} (duplicate key error)`);
        } else {
          throw error;
        }
      }
    } else {
      // Update existing Staff role to have isDefault: true if it doesn't already
      if (!existingStaffRole.isDefault) {
        existingStaffRole.isDefault = true;
        await existingStaffRole.save();
        console.log(`Updated existing Staff role to be default for organization ${organizationId}`);
      }
    }

    console.log(`Default roles check completed for organization ${organizationId}`);
  } catch (error) {
    console.error('Error creating default roles:', error);
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    
    // Check if role name already exists for this organization
    const existingRole = await Role.findOne({ 
      name: name, 
      organization: organizationId 
    });
    
    if (existingRole) {
      return res.status(400).json({ message: 'Role name already exists in this organization' });
    }

    const role = new Role({ 
      name, 
      permissions, 
      organization: organizationId,
      isDefault: false
    });
    await role.save();
    res.status(201).json(role);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    
    console.log('🔧 getRoles called for user:', {
      userId: req.user._id,
      userEmail: req.user.email,
      organization: req.user.organization,
      organizationId: organizationId,
      organizationType: typeof req.user.organization
    });
    
    // Ensure default roles exist for this organization
    await createDefaultRoles(organizationId);
    
    // Get all roles for this organization
    const roles = await Role.find({ organization: organizationId }).sort({ isDefault: -1, name: 1 });
    
    console.log(`🔧 Retrieved ${roles.length} roles for organization ${organizationId}`);
    console.log('🔧 Roles:', roles.map(r => ({ name: r.name, isDefault: r.isDefault, org: r.organization })));
    
    // Convert Map permissions to plain objects for JSON serialization
    const serializedRoles = roles.map(role => {
      const roleObj = role.toObject();
      
      // Convert Map permissions to plain object
      if (roleObj.permissions) {
        if (roleObj.permissions instanceof Map) {
          roleObj.permissions = Object.fromEntries(roleObj.permissions);
        }
        // If it's already a plain object, ensure nested Maps are converted too
        else if (typeof roleObj.permissions === 'object') {
          const convertedPerms = {};
          for (const [module, modulePerms] of Object.entries(roleObj.permissions)) {
            if (modulePerms instanceof Map) {
              convertedPerms[module] = Object.fromEntries(modulePerms);
            } else {
              convertedPerms[module] = modulePerms;
            }
          }
          roleObj.permissions = convertedPerms;
        }
      }
      
      return roleObj;
    });
    
    res.json(serializedRoles);
  } catch (err) {
    console.error('🔧 Error getting roles:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    
    // Find the role and ensure it belongs to the user's organization
    const role = await Role.findOne({ 
      _id: req.params.id, 
      organization: organizationId 
    });
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user.isSuperAdmin === true;

    // Allow editing default roles only for super admins
    if (role.isDefault && !isSuperAdmin) {
      return res.status(400).json({ message: 'Only super admins can modify default roles' });
    }

    // Check if the new name conflicts with existing roles in the same organization
    if (name !== role.name) {
      const existingRole = await Role.findOne({ 
        name: name, 
        organization: organizationId,
        _id: { $ne: req.params.id }
      });
      
      if (existingRole) {
        return res.status(400).json({ message: 'Role name already exists in this organization' });
      }
    }

    role.name = name;
    role.permissions = permissions;
    await role.save();
    
    res.json(role);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    
    // Find the role and ensure it belongs to the user's organization
    const role = await Role.findOne({ 
      _id: req.params.id, 
      organization: organizationId 
    });
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user.isSuperAdmin === true;

    // Allow deleting default roles only for super admins
    if (role.isDefault && !isSuperAdmin) {
      return res.status(400).json({ message: 'Only super admins can delete default roles' });
    }

    // Check if any users are currently using this role
    const User = require('../models/User');
    const usersWithRole = await User.countDocuments({ 
      organization: organizationId, 
      role: role.name 
    });

    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${usersWithRole} user(s) are currently assigned to this role. Please reassign them to another role first.` 
      });
    }

    await Role.findByIdAndDelete(req.params.id);
    res.json({ message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper function to check if user is super admin
const isSuperAdmin = async (userId, organizationId) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ _id: userId, organization: organizationId });
    return user && user.isSuperAdmin === true;
  } catch (error) {
    return false;
  }
};

// Get current user's super admin status
exports.getSuperAdminStatus = async (req, res) => {
  try {
    const isUserSuperAdmin = req.user.isSuperAdmin === true;
    res.json({ isSuperAdmin: isUserSuperAdmin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Promote a user to super admin (only existing super admins can do this)
exports.promoteToSuperAdmin = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ message: 'Only super admins can promote other users to super admin' });
    }
    
    // Handle organization field which might be populated (object) or just an ObjectId
    const organizationId = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
      ? req.user.organization._id
      : req.user.organization;
    
    // Find the user to promote
    const userToPromote = await User.findOne({ 
      _id: userId, 
      organization: organizationId 
    });
    
    if (!userToPromote) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (userToPromote.role !== 'admin') {
      return res.status(400).json({ message: 'Only admin users can be promoted to super admin' });
    }
    
    // Promote the user
    userToPromote.isSuperAdmin = true;
    await userToPromote.save();
    
    res.json({ message: 'User promoted to super admin successfully', user: userToPromote });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Export the helper function for use in other controllers
exports.createDefaultRoles = createDefaultRoles;
exports.isSuperAdmin = isSuperAdmin; 