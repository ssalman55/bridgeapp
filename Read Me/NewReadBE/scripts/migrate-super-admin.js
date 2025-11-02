const mongoose = require('mongoose');
const User = require('../src/models/User');
const Organization = require('../src/models/Organization');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function to add isSuperAdmin field
const migrateSuperAdmin = async () => {
  try {
    console.log('Starting super admin migration...');
    
    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);
    
    for (const organization of organizations) {
      console.log(`Processing organization: ${organization.name} (${organization._id})`);
      
      // Find the first admin user in this organization
      const firstAdmin = await User.findOne({ 
        organization: organization._id, 
        role: 'admin' 
      }).sort({ createdAt: 1 });
      
      if (firstAdmin) {
        // Mark this user as super admin
        await User.findByIdAndUpdate(firstAdmin._id, { isSuperAdmin: true });
        console.log(`  - Marked ${firstAdmin.email} as super admin`);
        
        // Update all other users in this organization to not be super admin
        await User.updateMany(
          { 
            organization: organization._id, 
            _id: { $ne: firstAdmin._id } 
          },
          { isSuperAdmin: false }
        );
        console.log(`  - Updated other users to not be super admin`);
      } else {
        console.log(`  - No admin users found in this organization`);
      }
    }
    
    console.log('Super admin migration completed successfully!');
    
    // Verify the migration
    const superAdmins = await User.find({ isSuperAdmin: true });
    console.log(`\nVerification: Found ${superAdmins.length} super admins:`);
    
    for (const admin of superAdmins) {
      const org = await Organization.findById(admin.organization);
      console.log(`  - ${admin.email} (${admin.fullName}) in ${org ? org.name : 'Unknown Org'}`);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await migrateSuperAdmin();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateSuperAdmin };









