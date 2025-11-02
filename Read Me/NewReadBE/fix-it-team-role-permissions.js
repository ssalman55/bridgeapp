const mongoose = require('mongoose');
const Role = require('./src/models/Role');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');

async function fixITTeamRolePermissions() {
  try {
    console.log('=== FIXING IT TEAM ROLE PERMISSIONS ===\n');
    
    // Find the IT Team role (case-insensitive)
    const itTeamRole = await Role.findOne({ 
      name: { $regex: /^it team$/i }
    });
    
    if (!itTeamRole) {
      console.log('❌ IT Team role not found');
      return;
    }
    
    console.log(`✅ Found IT Team role: "${itTeamRole.name}"`);
    console.log(`Organization: ${itTeamRole.organization}`);
    console.log(`Current permissions:`, JSON.stringify(itTeamRole.permissions, null, 2));
    
    // Update permissions to include System Setup
    if (!itTeamRole.permissions) {
      itTeamRole.permissions = {};
    }
    
    // Add System Setup permissions
    if (!itTeamRole.permissions['System Setup']) {
      itTeamRole.permissions['System Setup'] = {};
    }
    
    // Set System Variables to view access
    itTeamRole.permissions['System Setup']['System Variables'] = 'view';
    
    // Also add other essential permissions for IT Team
    if (!itTeamRole.permissions['Helpdesk']) {
      itTeamRole.permissions['Helpdesk'] = {};
    }
    
    // Give IT Team full access to Helpdesk
    itTeamRole.permissions['Helpdesk']['Dashboard'] = 'full';
    itTeamRole.permissions['Helpdesk']['All Tickets'] = 'full';
    itTeamRole.permissions['Helpdesk']['New Request'] = 'full';
    itTeamRole.permissions['Helpdesk']['My Requests'] = 'full';
    itTeamRole.permissions['Helpdesk']['Knowledge Base'] = 'full';
    itTeamRole.permissions['Helpdesk']['Categories'] = 'full';
    itTeamRole.permissions['Helpdesk']['Reports'] = 'full';
    
    // Give view access to Main dashboard
    if (!itTeamRole.permissions['Main']) {
      itTeamRole.permissions['Main'] = {};
    }
    itTeamRole.permissions['Main']['Dashboard'] = 'view';
    
    // Save the updated role
    await itTeamRole.save();
    
    console.log('\n✅ Updated IT Team role permissions:');
    console.log(JSON.stringify(itTeamRole.permissions, null, 2));
    
    console.log('\n=== SOLUTION APPLIED ===');
    console.log('✅ IT Team role now has "view" access to "System Setup" -> "System Variables"');
    console.log('✅ IT Team role now has "full" access to all Helpdesk features');
    console.log('✅ IT Team role now has "view" access to Main Dashboard');
    console.log('\nThis should fix the 403 errors for /api/settings and /api/organization/details');
    
  } catch (error) {
    console.error('Error fixing IT Team role permissions:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixITTeamRolePermissions();










































