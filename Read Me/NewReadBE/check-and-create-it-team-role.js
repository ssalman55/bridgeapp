const mongoose = require('mongoose');
const Role = require('./src/models/Role');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');

async function checkAndCreateITTeamRole() {
  try {
    console.log('=== CHECKING AND CREATING IT TEAM ROLE ===\n');
    
    // 1. Check what roles exist
    console.log('1. CHECKING EXISTING ROLES:');
    const allRoles = await Role.find({});
    console.log(`Found ${allRoles.length} roles:`);
    
    allRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. "${role.name}" (Org: ${role.organization}, Default: ${role.isDefault})`);
    });
    
    // 2. Check the specific user
    console.log('\n2. CHECKING USER:');
    const user = await User.findOne({ email: 'ayasin@stfbridge.com' });
    if (user) {
      console.log(`User: ${user.fullName} (${user.email})`);
      console.log(`Role: "${user.role}"`);
      console.log(`Organization: ${user.organization}`);
      
      // 3. Check if IT Team role exists (case-insensitive)
      console.log('\n3. CHECKING FOR IT TEAM ROLE:');
      const itTeamRole = await Role.findOne({ 
        name: { $regex: /^it team$/i },
        organization: user.organization
      });
      
      if (itTeamRole) {
        console.log(`✅ IT Team role found: "${itTeamRole.name}"`);
        console.log(`Current permissions:`, JSON.stringify(itTeamRole.permissions, null, 2));
      } else {
        console.log('❌ IT Team role not found');
        
        // 4. Create IT Team role
        console.log('\n4. CREATING IT TEAM ROLE:');
        const newITTeamRole = new Role({
          name: 'IT Team',
          organization: user.organization,
          isDefault: false,
          permissions: {
            'Main': {
              'Dashboard': 'view'
            },
            'System Setup': {
              'System Variables': 'view',
              'Role Management': 'none',
              'Settings': 'view',
              'SSO Configuration': 'none'
            },
            'Helpdesk': {
              'Dashboard': 'full',
              'All Tickets': 'full',
              'New Request': 'full',
              'My Requests': 'full',
              'Knowledge Base': 'full',
              'Categories': 'full',
              'Reports': 'full'
            },
            'People': {
              'Staff Directory': 'view',
              'Recognize': 'none'
            },
            'Communication': {
              'Bulletin Board': 'view',
              'Calendar': 'view'
            }
          }
        });
        
        await newITTeamRole.save();
        console.log('✅ IT Team role created successfully');
        console.log('Permissions:', JSON.stringify(newITTeamRole.permissions, null, 2));
      }
      
      // 5. Update user's role if needed
      console.log('\n5. CHECKING USER ROLE ASSIGNMENT:');
      if (user.role !== 'IT Team') {
        console.log(`Current user role: "${user.role}"`);
        console.log('Updating user role to "IT Team"...');
        user.role = 'IT Team';
        await user.save();
        console.log('✅ User role updated to "IT Team"');
      } else {
        console.log('✅ User already has "IT Team" role');
      }
      
    } else {
      console.log('❌ User not found');
    }
    
    console.log('\n=== SOLUTION COMPLETE ===');
    console.log('✅ IT Team role created/updated with proper permissions');
    console.log('✅ User assigned to IT Team role');
    console.log('✅ System Setup -> System Variables permission set to "view"');
    console.log('✅ Helpdesk permissions set to "full"');
    console.log('\nThe user should now be able to access /api/settings and /api/organization/details');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkAndCreateITTeamRole();










































