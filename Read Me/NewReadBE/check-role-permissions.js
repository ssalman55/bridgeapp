const mongoose = require('mongoose');
const Role = require('./src/models/Role');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkRolePermissions() {
  try {
    console.log('=== CHECKING ROLE PERMISSIONS ===');
    
    // Find the IT Team role
    const itTeamRole = await Role.findOne({ name: 'IT Team' });
    
    if (!itTeamRole) {
      console.log('❌ IT Team role not found');
      return;
    }
    
    console.log('✅ Found IT Team role:', itTeamRole.name);
    console.log('Current permissions:', JSON.stringify(itTeamRole.permissions, null, 2));
    
    // Check if it has System Setup permissions
    const hasSystemSetup = itTeamRole.permissions && 
      itTeamRole.permissions['System Setup'] && 
      itTeamRole.permissions['System Setup']['System Variables'];
    
    console.log('Has System Setup - System Variables permission:', hasSystemSetup);
    
    if (!hasSystemSetup) {
      console.log('❌ IT Team role is missing System Setup permissions');
      console.log('This is why the user gets 403 errors for /api/settings and /api/organization/details');
    } else {
      console.log('✅ IT Team role has System Setup permissions');
    }
    
  } catch (error) {
    console.error('Error checking role permissions:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkRolePermissions();


































