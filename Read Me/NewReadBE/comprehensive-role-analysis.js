const mongoose = require('mongoose');
const Role = require('./src/models/Role');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');

async function comprehensiveRoleAnalysis() {
  try {
    console.log('=== COMPREHENSIVE ROLE MANAGEMENT ANALYSIS ===\n');
    
    // 1. Check all roles in database
    console.log('1. CHECKING ALL ROLES IN DATABASE:');
    const allRoles = await Role.find({});
    console.log(`Found ${allRoles.length} roles total:`);
    
    allRoles.forEach((role, index) => {
      console.log(`\n${index + 1}. Role: "${role.name}"`);
      console.log(`   ID: ${role._id}`);
      console.log(`   Organization: ${role.organization}`);
      console.log(`   Is Default: ${role.isDefault}`);
      console.log(`   Permissions Type: ${typeof role.permissions}`);
      console.log(`   Permissions:`, JSON.stringify(role.permissions, null, 2));
    });
    
    // 2. Check specific user's role
    console.log('\n\n2. CHECKING SPECIFIC USER ROLE:');
    const user = await User.findOne({ email: 'ayasin@stfbridge.com' });
    if (user) {
      console.log(`User found: ${user.fullName} (${user.email})`);
      console.log(`User role: "${user.role}"`);
      console.log(`User organization: ${user.organization}`);
      
      // Find the role document
      const userRole = await Role.findOne({ 
        name: user.role,
        organization: user.organization 
      });
      
      if (userRole) {
        console.log(`\nRole document found:`);
        console.log(`Role name: "${userRole.name}"`);
        console.log(`Role permissions:`, JSON.stringify(userRole.permissions, null, 2));
        
        // Check specific permissions
        console.log(`\nChecking System Setup permissions:`);
        const systemSetupPerms = userRole.permissions['System Setup'];
        console.log(`System Setup permissions:`, systemSetupPerms);
        
        if (systemSetupPerms && typeof systemSetupPerms === 'object') {
          const systemVarsPerm = systemSetupPerms['System Variables'];
          console.log(`System Variables permission: "${systemVarsPerm}"`);
        }
      } else {
        console.log(`❌ Role document NOT found for role "${user.role}" in organization ${user.organization}`);
      }
    } else {
      console.log('❌ User not found');
    }
    
    // 3. Check permission structure consistency
    console.log('\n\n3. CHECKING PERMISSION STRUCTURE CONSISTENCY:');
    
    // Expected modules from frontend
    const expectedModules = {
      'Main': ['Dashboard'],
      'People': ['Staff Directory', 'Recognize'],
      'Staff Management': ['Create', 'Profiles', 'Documents', 'Assign a Task', 'View Tasks', 'Recognition Approvals'],
      'Onboarding': ['Dashboard', 'Manage Templates', 'New Onboarding', 'Pipelines', 'Manage Tasks'],
      'Operations': ['Events', 'Create Event', 'Request Event', 'My Events', 'Approvals', 'Templates', 'Calendar'],
      'Attendance': ["Today's Presents", "Today's Absents", 'Monthly Absents', 'Attendance Tracker', 'Leave Management', 'Leave Tracker', 'Upcoming Leaves'],
      'Learning & Growth': ['Learning Requests', 'Approved Learnings', 'Rejected Learning', 'Learning Cost', 'Performance Evaluation'],
      'Salary': ['Salary Management', 'Bank Details', 'Custom Report Builder'],
      'Payroll': ['Payroll Management', 'Payroll Journal', 'Monthly Payroll Summary', 'Yearly Payroll', 'Payroll Audit Trail', 'Generate Payroll File'],
      'Expenses': ['Pending Claims', 'Approved Claims', 'Rejected Claims', 'Monthly Expense', 'Yearly Expense'],
      'Assets': ['Create Items', 'Assets Management', 'Assets Summary', 'Approved Assets', 'Rejected Assets', 'Assets Requests'],
      'Communication': ['Bulletin Board', 'Calendar'],
      'Helpdesk': ['Dashboard', 'All Tickets', 'New Request', 'My Requests', 'Knowledge Base', 'Categories', 'Reports'],
      'Admin': ['Role Management', 'System Variables', 'Create Geofence', 'Geofence Settings', 'SSO Configuration', 'Billing']
    };
    
    console.log('Expected modules structure:');
    Object.entries(expectedModules).forEach(([module, pages]) => {
      console.log(`  ${module}: [${pages.join(', ')}]`);
    });
    
    // 4. Check if IT Team role exists and has correct permissions
    console.log('\n\n4. CHECKING IT TEAM ROLE:');
    const itTeamRole = await Role.findOne({ name: 'IT Team' });
    if (itTeamRole) {
      console.log(`✅ IT Team role found`);
      console.log(`Organization: ${itTeamRole.organization}`);
      console.log(`Is Default: ${itTeamRole.isDefault}`);
      console.log(`Permissions:`, JSON.stringify(itTeamRole.permissions, null, 2));
      
      // Check if it has System Setup permissions
      const hasSystemSetup = itTeamRole.permissions && 
        itTeamRole.permissions['System Setup'] && 
        itTeamRole.permissions['System Setup']['System Variables'];
      
      console.log(`\nHas System Setup -> System Variables permission: ${hasSystemSetup}`);
      
      if (!hasSystemSetup) {
        console.log('❌ IT Team role is missing System Setup permissions');
        console.log('This is why the user gets 403 errors for /api/settings and /api/organization/details');
      }
    } else {
      console.log('❌ IT Team role not found');
    }
    
    // 5. Check all users with IT Team role
    console.log('\n\n5. CHECKING USERS WITH IT TEAM ROLE:');
    const itTeamUsers = await User.find({ role: 'IT Team' });
    console.log(`Found ${itTeamUsers.length} users with IT Team role:`);
    itTeamUsers.forEach(user => {
      console.log(`  - ${user.fullName} (${user.email}) - Org: ${user.organization}`);
    });
    
    // 6. Check case sensitivity issues
    console.log('\n\n6. CHECKING CASE SENSITIVITY ISSUES:');
    const caseVariations = ['IT Team', 'it team', 'It Team', 'IT TEAM'];
    for (const variation of caseVariations) {
      const role = await Role.findOne({ name: variation });
      if (role) {
        console.log(`Found role with name "${variation}": ${role._id}`);
      }
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    mongoose.connection.close();
  }
}

comprehensiveRoleAnalysis();










































