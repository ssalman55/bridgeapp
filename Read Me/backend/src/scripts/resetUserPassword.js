const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// MongoDB connection string - replace with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge';

async function resetUserPassword(email, newPassword) {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found with email:', email);
      return;
    }

    console.log('User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      organization: user.organization
    });

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password directly (bypass pre-save middleware to avoid double hashing)
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    console.log('Password reset successful');
    
    // Verify the new password
    const updatedUser = await User.findOne({ email }).select('+password');
    const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
    
    console.log('\nVerification:', {
      passwordUpdated: updatedUser.password !== user.password,
      newPasswordWorks: isMatch,
      hashFormat: updatedUser.password.substring(0, 7) + '...'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Get email and new password from command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: node resetUserPassword.js <email> <newPassword>');
  process.exit(1);
}

resetUserPassword(email, newPassword); 