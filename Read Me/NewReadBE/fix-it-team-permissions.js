const mongoose = require('mongoose');
const Role = require('./src/models/Role');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixITTeamPermissions() {
  try {
    console.log('=== FIXING IT TEAM PERMISSIONS ===');
    
    // Find the IT Team role
    const itTeamRole = await Role.findOne({ name: 'IT Team' });
    
    if (!itTeamRole) {
      console.log('❌ IT Team role not found');
      return;
    }
    
    console.log('✅ Found IT Team role:', itTeamRole.name);
    console.log('Current permissions:', JSON.stringify(itTeamRole.permissions, null, 2));
    
    // Add System Setup permissions
    if (!itTeamRole.permissions) {
      itTeamRole.permissions = {};
    }
    
    if (!itTeamRole.permissions['System Setup']) {
      itTeamRole.permissions['System Setup'] = {};
    }
    
    // Add System Variables permission with view access
    itTeamRole.permissions['System Setup']['System Variables'] = 'view';
    
    // Save the updated role
    await itTeamRole.save();
    
    console.log('✅ Updated IT Team role permissions');
    console.log('New permissions:', JSON.stringify(itTeamRole.permissions, null, 2));
    
    console.log('\n=== SOLUTION ===');
    console.log('The IT Team role now has "view" access to "System Setup" -> "System Variables"');
    console.log('This should fix the 403 errors for /api/settings and /api/organization/details');
    
  } catch (error) {
    console.error('Error fixing role permissions:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixITTeamPermissions();


































