const mongoose = require('mongoose');

console.log('=== DEBUGGING ROLE ISSUE ===');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Try to require the Role model
    try {
      const Role = require('./src/models/Role');
      console.log('✅ Role model loaded successfully');
      
      // Try to find roles
      Role.find({})
        .then(roles => {
          console.log(`✅ Found ${roles.length} roles in database`);
          
          if (roles.length > 0) {
            console.log('First role:', roles[0]);
          }
          
          mongoose.connection.close();
        })
        .catch(error => {
          console.error('❌ Error finding roles:', error);
          mongoose.connection.close();
        });
        
    } catch (error) {
      console.error('❌ Error loading Role model:', error);
      mongoose.connection.close();
    }
  })
  .catch(error => {
    console.error('❌ Error connecting to MongoDB:', error);
  });


































