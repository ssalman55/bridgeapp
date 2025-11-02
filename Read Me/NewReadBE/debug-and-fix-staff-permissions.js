require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./src/models/Role');

async function debugAndFixStaffPermissions() {
  try {
    console.log('🔍 Debugging Staff Role Permissions Structure...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('✅ Connected to MongoDB');

    // Find one staff role to examine its structure
    const staffRole = await Role.findOne({ 
      name: { $regex: /^staff$/i } 
    });

    if (!staffRole) {
      console.log('❌ No staff role found');
      return;
    }

    console.log('\n🔍 Examining role structure:');
    console.log('Role name:', staffRole.name);
    console.log('Organization:', staffRole.organization);
    console.log('Permissions type:', typeof staffRole.permissions);
    console.log('Permissions constructor:', staffRole.permissions?.constructor?.name);
    console.log('Permissions keys:', Object.keys(staffRole.permissions || {}));
    
    if (staffRole.permissions && staffRole.permissions.Inventory) {
      console.log('Inventory permissions type:', typeof staffRole.permissions.Inventory);
      console.log('Inventory permissions:', staffRole.permissions.Inventory);
    }

    // Now fix all staff roles
    console.log('\n🔧 Fixing all staff roles...');
    const staffRoles = await Role.find({ 
      name: { $regex: /^staff$/i } 
    });

    let updatedCount = 0;

    for (const role of staffRoles) {
      console.log(`\n🏢 Processing ${role.name} role for organization: ${role.organization}`);
      
      let needsUpdate = false;

      // Handle plain object permissions
      if (role.permissions && typeof role.permissions === 'object' && !(role.permissions instanceof Map)) {
        if (role.permissions.Inventory && role.permissions.Inventory['Create Items'] === 'none') {
          role.permissions.Inventory['Create Items'] = 'view';
          needsUpdate = true;
          console.log('   🔄 Updating Create Items permission from "none" to "view"');
        }
      }

      if (needsUpdate) {
        await role.save();
        console.log('   ✅ Updated successfully');
        updatedCount++;
      } else {
        console.log('   ⏭️  No update needed');
      }
    }

    console.log('\n🎉 Fix completed!');
    console.log('📊 Summary:');
    console.log(`   • Roles updated: ${updatedCount}`);
    console.log(`   • Total processed: ${staffRoles.length}`);

    // Final verification
    console.log('\n🔍 Final Verification:');
    const updatedRoles = await Role.find({ 
      name: { $regex: /^staff$/i } 
    });

    for (const role of updatedRoles) {
      console.log(`\n🏢 ${role.name} role (${role.organization}):`);
      if (role.permissions && role.permissions.Inventory) {
        console.log('   ✅ Inventory permissions:');
        console.log('     - Create Items:', role.permissions.Inventory['Create Items']);
        console.log('     - Inventory Management:', role.permissions.Inventory['Inventory Management']);
        console.log('     - Inventory Summary:', role.permissions.Inventory['Inventory Summary']);
        console.log('     - View Requests:', role.permissions.Inventory['View Requests']);
      }
    }

    console.log('\n✅ Staff users should now be able to access the Request Inventory page!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugAndFixStaffPermissions().catch(console.error);




