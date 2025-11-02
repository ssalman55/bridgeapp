// Script to fix duplicate roles and ensure database consistency
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../src/models/Role');
const Organization = require('../src/models/Organization');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixRoleDuplicates() {
  try {
    console.log('Starting role duplicate fix...');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);

    for (const organization of organizations) {
      console.log(`\nProcessing organization: ${organization.name} (${organization._id})`);

      // Find all roles for this organization
      const roles = await Role.find({ organization: organization._id });
      console.log(`Found ${roles.length} roles for organization`);

      // Check for duplicate Admin roles
      const adminRoles = roles.filter(role => role.name === 'Admin');
      if (adminRoles.length > 1) {
        console.log(`Found ${adminRoles.length} Admin roles, keeping the first one and removing duplicates`);
        // Keep the first one, remove the rest
        for (let i = 1; i < adminRoles.length; i++) {
          await Role.findByIdAndDelete(adminRoles[i]._id);
          console.log(`Removed duplicate Admin role: ${adminRoles[i]._id}`);
        }
      }

      // Check for duplicate Staff roles
      const staffRoles = roles.filter(role => role.name === 'Staff');
      if (staffRoles.length > 1) {
        console.log(`Found ${staffRoles.length} Staff roles, keeping the first one and removing duplicates`);
        // Keep the first one, remove the rest
        for (let i = 1; i < staffRoles.length; i++) {
          await Role.findByIdAndDelete(staffRoles[i]._id);
          console.log(`Removed duplicate Staff role: ${staffRoles[i]._id}`);
        }
      }

      // Check for roles without organization field (global roles)
      const globalRoles = await Role.find({ organization: { $exists: false } });
      if (globalRoles.length > 0) {
        console.log(`Found ${globalRoles.length} global roles (no organization field)`);
        
        for (const globalRole of globalRoles) {
          // Check if this role name already exists for this organization
          const existingRole = await Role.findOne({ 
            name: globalRole.name, 
            organization: organization._id 
          });

          if (!existingRole && globalRole.name !== 'Admin' && globalRole.name !== 'Staff') {
            // Create a copy for this organization
            const newRole = new Role({
              name: globalRole.name,
              organization: organization._id,
              permissions: globalRole.permissions,
              isDefault: false
            });
            await newRole.save();
            console.log(`Created copy of global role: ${globalRole.name} for organization ${organization.name}`);
          }
        }
      }

      // Ensure default roles exist and have isDefault: true
      const adminRole = await Role.findOne({ name: 'Admin', organization: organization._id });
      if (adminRole && !adminRole.isDefault) {
        adminRole.isDefault = true;
        await adminRole.save();
        console.log(`Updated Admin role to be default for organization ${organization.name}`);
      }

      const staffRole = await Role.findOne({ name: 'Staff', organization: organization._id });
      if (staffRole && !staffRole.isDefault) {
        staffRole.isDefault = true;
        await staffRole.save();
        console.log(`Updated Staff role to be default for organization ${organization.name}`);
      }
    }

    console.log('\n🎉 Role duplicate fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing role duplicates:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the fix
fixRoleDuplicates(); 