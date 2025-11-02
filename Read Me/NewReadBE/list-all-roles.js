const mongoose = require('mongoose');
const Role = require('./src/models/Role');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function listAllRoles() {
  try {
    console.log('=== LISTING ALL ROLES ===');
    
    const roles = await Role.find({});
    
    console.log(`Found ${roles.length} roles:`);
    
    roles.forEach((role, index) => {
      console.log(`\n${index + 1}. Role Name: "${role.name}"`);
      console.log(`   ID: ${role._id}`);
      console.log(`   Is Default: ${role.isDefault || false}`);
      console.log(`   Permissions:`, JSON.stringify(role.permissions, null, 4));
    });
    
  } catch (error) {
    console.error('Error listing roles:', error);
  } finally {
    mongoose.connection.close();
  }
}

listAllRoles();


































