const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for fixing organization creator super admin status');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

const fixOrganizationCreatorSuperAdmin = async () => {
  await connectDB();

  try {
    // Find all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);

    for (const org of organizations) {
      console.log(`\nProcessing organization: ${org.name} (${org._id})`);
      
      // Find the user who created this organization (usually the first user with admin role)
      const creator = await User.findOne({ 
        organization: org._id,
        role: 'admin'
      }).sort({ createdAt: 1 }); // Get the first admin user (likely the creator)
      
      if (creator) {
        console.log(`Found potential creator: ${creator.email} (${creator.fullName})`);
        console.log(`Current isSuperAdmin status: ${creator.isSuperAdmin}`);
        
        if (!creator.isSuperAdmin) {
          // Set the creator as super admin
          creator.isSuperAdmin = true;
          await creator.save();
          console.log(`✅ Set ${creator.email} as super admin for organization ${org.name}`);
        } else {
          console.log(`✅ ${creator.email} is already a super admin`);
        }
      } else {
        console.log(`❌ No admin user found for organization ${org.name}`);
      }
    }

    console.log(`\n✅ Completed fixing organization creator super admin status`);
  } catch (error) {
    console.error('Error fixing organization creator super admin status:', error);
  } finally {
    mongoose.disconnect();
  }
};

fixOrganizationCreatorSuperAdmin();










