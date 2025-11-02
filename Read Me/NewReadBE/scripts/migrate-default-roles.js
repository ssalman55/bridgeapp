const mongoose = require('mongoose');
const Role = require('../src/models/Role');
const Organization = require('../src/models/Organization');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function to ensure all organizations have default roles
const migrateDefaultRoles = async () => {
  try {
    console.log('Starting default roles migration...');
    
    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);
    
    // Get all existing roles
    const allRoles = await Role.find({});
    console.log(`Found ${allRoles.length} total roles`);
    
    // Clean up any duplicate default roles (keep only one per organization)
    for (const organization of organizations) {
      console.log(`\nProcessing organization: ${organization.name} (${organization._id})`);
      
      // Find all Admin and Staff roles for this organization
      const adminRoles = await Role.find({ 
        name: 'Admin', 
        organization: organization._id 
      });
      const staffRoles = await Role.find({ 
        name: 'Staff', 
        organization: organization._id 
      });
      
      // Remove duplicate Admin roles (keep the first one)
      if (adminRoles.length > 1) {
        console.log(`  - Found ${adminRoles.length} Admin roles, removing duplicates`);
        for (let i = 1; i < adminRoles.length; i++) {
          await Role.findByIdAndDelete(adminRoles[i]._id);
          console.log(`    - Removed duplicate Admin role: ${adminRoles[i]._id}`);
        }
      }
      
      // Remove duplicate Staff roles (keep the first one)
      if (staffRoles.length > 1) {
        console.log(`  - Found ${staffRoles.length} Staff roles, removing duplicates`);
        for (let i = 1; i < staffRoles.length; i++) {
          await Role.findByIdAndDelete(staffRoles[i]._id);
          console.log(`    - Removed duplicate Staff role: ${staffRoles[i]._id}`);
        }
      }
      
      // Get the remaining Admin and Staff roles
      const adminRole = await Role.findOne({ 
        name: 'Admin', 
        organization: organization._id 
      });
      const staffRole = await Role.findOne({ 
        name: 'Staff', 
        organization: organization._id 
      });
      
      // Create Admin role if it doesn't exist
      if (!adminRole) {
        console.log(`  - Creating Admin role for organization ${organization.name}`);
        const newAdminRole = new Role({
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
        await newAdminRole.save();
        console.log(`    - Admin role created successfully`);
      } else {
        console.log(`  - Admin role already exists`);
        // Ensure it's marked as default
        if (!adminRole.isDefault) {
          adminRole.isDefault = true;
          await adminRole.save();
          console.log(`    - Updated Admin role to be default`);
        }
      }
      
      // Create Staff role if it doesn't exist
      if (!staffRole) {
        console.log(`  - Creating Staff role for organization ${organization.name}`);
        const newStaffRole = new Role({
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
        await newStaffRole.save();
        console.log(`    - Staff role created successfully`);
      } else {
        console.log(`  - Staff role already exists`);
        // Ensure it's marked as default
        if (!staffRole.isDefault) {
          staffRole.isDefault = true;
          await staffRole.save();
          console.log(`    - Updated Staff role to be default`);
        }
      }
    }
    
    console.log('\nDefault roles migration completed successfully!');
    
    // Verify the migration
    const totalRoles = await Role.countDocuments();
    const defaultRoles = await Role.countDocuments({ isDefault: true });
    const organizationCount = await Organization.countDocuments();
    const expectedDefaultRoles = organizationCount * 2; // 2 default roles per organization
    
    console.log(`\nVerification:`);
    console.log(`  - Total organizations: ${organizationCount}`);
    console.log(`  - Total roles: ${totalRoles}`);
    console.log(`  - Default roles: ${defaultRoles}`);
    console.log(`  - Expected default roles: ${expectedDefaultRoles}`);
    
    if (defaultRoles === expectedDefaultRoles) {
      console.log(`  ✅ Migration successful - all organizations have default roles`);
    } else {
      console.log(`  ⚠️  Migration may have issues - expected ${expectedDefaultRoles} default roles but found ${defaultRoles}`);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await migrateDefaultRoles();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateDefaultRoles };
