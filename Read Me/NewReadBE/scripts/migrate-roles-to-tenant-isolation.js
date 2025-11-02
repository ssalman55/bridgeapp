// Migration script to implement tenant isolation for roles
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../src/models/Role');
const Organization = require('../src/models/Organization');
const User = require('../src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function migrateRolesToTenantIsolation() {
  try {
    console.log('Starting role migration to tenant isolation...');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);

    // Get all existing roles
    const existingRoles = await Role.find({});
    console.log(`Found ${existingRoles.length} existing roles`);

    // Process each organization
    for (const organization of organizations) {
      console.log(`\nProcessing organization: ${organization.name} (${organization._id})`);

      // Create default roles if they don't exist for this organization
      const existingAdminRole = await Role.findOne({ 
        name: 'Admin', 
        organization: organization._id 
      });
      const existingStaffRole = await Role.findOne({ 
        name: 'Staff', 
        organization: organization._id 
      });

      if (!existingAdminRole) {
        // Create Admin role
        const adminRole = new Role({
          name: 'Admin',
          organization: organization._id,
          isDefault: true,
          permissions: {
            'Main': { 'Home': 'full', 'Dashboard': 'full' },
            'Communication': { 'Bulletin Board': 'full', 'Calendar': 'full' },
            'Staff Management': { 'Create Staff': 'full', 'Staff Profiles': 'full', 'Documents': 'full' },
            'Attendance': { "Today's Presents": 'full', "Today's Absents": 'full', 'Monthly Absents': 'full', 'Attendance Tracker': 'full' },
            'Leave': { 'Leave Management': 'full', 'Leave Tracker': 'full', 'Upcoming Leaves': 'full' },
            'Trainings': { 'Pending Requests': 'full', 'Approved Trainings': 'full', 'Rejected Trainings': 'full', 'Training Costs': 'full' },
            'Tasks': { 'Create Tasks': 'full', 'View Tasks': 'full' },
            'Salary & Payroll': { 'Salary Management': 'full', 'Payroll Management': 'full', 'Bank Details': 'full', 'Payroll Journal': 'full', 'Monthly Payroll Summary': 'full', 'Yearly Payroll': 'full', 'Payroll Audit Trail': 'full', 'Custom Report Builder': 'full', 'Generate Payroll File': 'full' },
            'Expenses': { 'Pending Claims': 'full', 'Approved Claims': 'full', 'Rejected Claims': 'full', 'Monthly Expense': 'full', 'Yearly Expense': 'full' },
            'Inventory': { 'Create Items': 'full', 'Inventory Management': 'full', 'Inventory Summary': 'full', 'Approved Inventory': 'full', 'Rejected Inventory': 'full', 'View Requests': 'full' },
            'Recognitions': { 'Peer Recognitions': 'full', 'Recognize': 'full' },
            'Evaluation': { 'Performance Evaluation': 'full' },
            'Geofencing': { 'Geofence Management': 'full' },
            'Billing': { 'Billing': 'full' },
            'System Setup': { 'Role Management': 'full', 'System Variables': 'full', 'Settings': 'full' }
          }
        });
        await adminRole.save();
        console.log('✅ Admin role created');
      } else {
        console.log('Admin role already exists for organization');
      }

      if (!existingStaffRole) {
        // Create Staff role
        const staffRole = new Role({
          name: 'Staff',
          organization: organization._id,
          isDefault: true,
          permissions: {
            'Main': { 'Home': 'view', 'Dashboard': 'view' },
            'Communication': { 'Bulletin Board': 'view', 'Calendar': 'view' },
            'Staff Management': { 'Create Staff': 'none', 'Staff Profiles': 'view', 'Documents': 'view' },
            'Attendance': { "Today's Presents": 'view', "Today's Absents": 'view', 'Monthly Absents': 'view', 'Attendance Tracker': 'view' },
            'Leave': { 'Leave Management': 'view', 'Leave Tracker': 'view', 'Upcoming Leaves': 'view' },
            'Trainings': { 'Pending Requests': 'view', 'Approved Trainings': 'view', 'Rejected Trainings': 'view', 'Training Costs': 'view' },
            'Tasks': { 'Create Tasks': 'view', 'View Tasks': 'view' },
            'Salary & Payroll': { 'Salary Management': 'view', 'Payroll Management': 'view', 'Bank Details': 'view', 'Payroll Journal': 'none', 'Monthly Payroll Summary': 'none', 'Yearly Payroll': 'none', 'Payroll Audit Trail': 'none', 'Custom Report Builder': 'none', 'Generate Payroll File': 'none' },
            'Expenses': { 'Pending Claims': 'view', 'Approved Claims': 'view', 'Rejected Claims': 'view', 'Monthly Expense': 'none', 'Yearly Expense': 'none' },
            'Inventory': { 'Create Items': 'none', 'Inventory Management': 'view', 'Inventory Summary': 'view', 'Approved Inventory': 'view', 'Rejected Inventory': 'view', 'View Requests': 'view' },
            'Recognitions': { 'Peer Recognitions': 'view', 'Recognize': 'view' },
            'Evaluation': { 'Performance Evaluation': 'view' },
            'Geofencing': { 'Geofence Management': 'none' },
            'Billing': { 'Billing': 'none' },
            'System Setup': { 'Role Management': 'none', 'System Variables': 'none', 'Settings': 'none' }
          }
        });
        await staffRole.save();
        console.log('✅ Staff role created');
      } else {
        console.log('Staff role already exists for organization');
      }

      // Handle existing roles that might be global (no organization field)
      const globalRoles = existingRoles.filter(role => !role.organization);
      
      if (globalRoles.length > 0) {
        console.log(`Found ${globalRoles.length} global roles to migrate...`);
        
        for (const globalRole of globalRoles) {
          // Skip if this role name already exists for this organization
          const existingRole = await Role.findOne({ 
            name: globalRole.name, 
            organization: organization._id 
          });

          if (!existingRole && globalRole.name !== 'Admin' && globalRole.name !== 'Staff') {
            // Create a copy of the global role for this organization
            const newRole = new Role({
              name: globalRole.name,
              organization: organization._id,
              permissions: globalRole.permissions,
              isDefault: false
            });
            await newRole.save();
            console.log(`✅ Migrated role: ${globalRole.name}`);
          }
        }
      }
    }

    // Clean up global roles (optional - uncomment if you want to remove them)
    // console.log('\nCleaning up global roles...');
    // await Role.deleteMany({ organization: { $exists: false } });
    // console.log('✅ Global roles cleaned up');

    console.log('\n🎉 Role migration completed successfully!');
    console.log('\nSummary:');
    console.log('- Default roles (Admin and Staff) created for each organization');
    console.log('- Existing global roles migrated to organization-specific roles');
    console.log('- Tenant isolation implemented');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the migration
migrateRolesToTenantIsolation(); 