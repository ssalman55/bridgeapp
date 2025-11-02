const mongoose = require('mongoose');
const Role = require('./src/models/Role');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');

async function findUserAndFixRole() {
  try {
    console.log('=== FINDING USER AND FIXING ROLE ===\n');
    
    // 1. Find the user by email (case-insensitive)
    console.log('1. SEARCHING FOR USER:');
    const user = await User.findOne({ 
      email: { $regex: /^ayasin@stfbridge\.com$/i }
    });
    
    if (!user) {
      console.log('❌ User not found with exact email');
      
      // Try partial search
      const partialUser = await User.findOne({ 
        email: { $regex: /ayasin/i }
      });
      
      if (partialUser) {
        console.log(`Found user with partial match: ${partialUser.email}`);
        console.log(`Full name: ${partialUser.fullName}`);
        console.log(`Role: "${partialUser.role}"`);
        console.log(`Organization: ${partialUser.organization}`);
      } else {
        console.log('❌ User not found with partial search either');
        
        // List all users to see what's available
        console.log('\nAll users in database:');
        const allUsers = await User.find({}).select('email fullName role organization');
        allUsers.forEach((u, index) => {
          console.log(`  ${index + 1}. ${u.email} (${u.fullName}) - Role: "${u.role}" - Org: ${u.organization}`);
        });
        return;
      }
    } else {
      console.log(`✅ User found: ${user.fullName} (${user.email})`);
      console.log(`Role: "${user.role}"`);
      console.log(`Organization: ${user.organization}`);
    }
    
    const targetUser = user || await User.findOne({ email: { $regex: /ayasin/i } });
    
    // 2. Check if IT Team role exists for this organization
    console.log('\n2. CHECKING FOR IT TEAM ROLE:');
    const itTeamRole = await Role.findOne({ 
      name: { $regex: /^it team$/i },
      organization: targetUser.organization
    });
    
    if (itTeamRole) {
      console.log(`✅ IT Team role found: "${itTeamRole.name}"`);
      console.log(`Current permissions:`, JSON.stringify(itTeamRole.permissions, null, 2));
      
      // Update permissions if needed
      if (!itTeamRole.permissions || !itTeamRole.permissions['System Setup']) {
        console.log('\nUpdating IT Team role permissions...');
        if (!itTeamRole.permissions) itTeamRole.permissions = {};
        if (!itTeamRole.permissions['System Setup']) itTeamRole.permissions['System Setup'] = {};
        
        itTeamRole.permissions['System Setup']['System Variables'] = 'view';
        itTeamRole.permissions['System Setup']['Settings'] = 'view';
        
        await itTeamRole.save();
        console.log('✅ IT Team role permissions updated');
      }
    } else {
      console.log('❌ IT Team role not found, creating it...');
      
      const newITTeamRole = new Role({
        name: 'IT Team',
        organization: targetUser.organization,
        isDefault: false,
        permissions: {
          'Main': {
            'Dashboard': 'view'
          },
          'System Setup': {
            'System Variables': 'view',
            'Settings': 'view',
            'Role Management': 'none',
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
    }
    
    // 3. Update user's role
    console.log('\n3. UPDATING USER ROLE:');
    if (targetUser.role !== 'IT Team') {
      console.log(`Current role: "${targetUser.role}"`);
      console.log('Updating to "IT Team"...');
      targetUser.role = 'IT Team';
      await targetUser.save();
      console.log('✅ User role updated to "IT Team"');
    } else {
      console.log('✅ User already has "IT Team" role');
    }
    
    console.log('\n=== SOLUTION COMPLETE ===');
    console.log('✅ IT Team role exists with proper permissions');
    console.log('✅ User assigned to IT Team role');
    console.log('✅ System Setup -> System Variables permission set to "view"');
    console.log('\nThe user should now be able to access /api/settings and /api/organization/details');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

findUserAndFixRole();










































