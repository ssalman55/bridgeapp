const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Organization = require('../models/Organization');

// Load environment variables
dotenv.config();

const fixUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Find or create organization
    let organization = await Organization.findOne({ name: 'Default Organization' });
    if (!organization) {
      organization = new Organization({
        name: 'Default Organization',
        email: 'admin@default.org'
      });
      await organization.save();
      console.log('Created new organization:', organization._id);
    }

    // Find the user
    const user = await User.findOne({ email: 'hafsah@gmail.com' });
    if (!user) {
      console.error('User not found');
      process.exit(1);
    }

    // Update user's organization and reset password
    user.organization = organization._id;
    user.password = 'Acsdoha123!'; // This will be hashed by the pre-save middleware
    await user.save();

    console.log('User updated successfully:', {
      email: user.email,
      organizationId: user.organization,
      newPassword: 'Acsdoha123!'
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixUser(); 