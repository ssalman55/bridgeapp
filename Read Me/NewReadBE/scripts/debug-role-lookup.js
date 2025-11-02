// Debug script to check role lookup issue
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../src/models/Role');
const User = require('../src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function debugRoleLookup() {
  try {
    console.log('Starting role lookup debug...');

    // Find the user
    const user = await User.findOne({ email: 'ayusuf@acsdoha.school' });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      organization: user.organization
    });

    // Check all roles in the organization
    const allRoles = await Role.find({ organization: user.organization });
    console.log(`\nFound ${allRoles.length} roles in organization ${user.organization}:`);
    allRoles.forEach(role => {
      console.log(`- "${role.name}" (isDefault: ${role.isDefault})`);
    });

    // Try exact match
    const exactMatch = await Role.findOne({ 
      name: user.role, 
      organization: user.organization 
    });
    console.log(`\nExact match for "${user.role}":`, exactMatch ? 'Found' : 'Not found');

    // Try case-insensitive match
    const roleName = user.role ? user.role.toLowerCase() : '';
    const caseInsensitiveMatch = await Role.findOne({ 
      name: new RegExp('^' + roleName + '$', 'i'),
      organization: user.organization 
    });
    console.log(`\nCase-insensitive match for "${user.role}":`, caseInsensitiveMatch ? 'Found' : 'Not found');

    if (caseInsensitiveMatch) {
      console.log('Role details:', {
        name: caseInsensitiveMatch.name,
        permissions: caseInsensitiveMatch.permissions,
        isDefault: caseInsensitiveMatch.isDefault
      });
    }

    // Check if there are any roles with similar names
    const similarRoles = await Role.find({ 
      name: new RegExp(user.role, 'i'),
      organization: user.organization 
    });
    console.log(`\nSimilar roles (case-insensitive partial match):`);
    similarRoles.forEach(role => {
      console.log(`- "${role.name}"`);
    });

  } catch (error) {
    console.error('Error debugging role lookup:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the debug
debugRoleLookup(); 