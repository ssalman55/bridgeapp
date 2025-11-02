const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// MongoDB connection string - replace with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge';

async function verifyUserPassword(email, testPassword) {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('User not found with email:', email);
      return;
    }

    console.log('User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      organization: user.organization,
      passwordDetails: {
        length: user.password.length,
        prefix: user.password.substring(0, 10) + '...',
        isHashed: user.password.startsWith('$2'),
        bcryptVersion: user.password.substring(0, 4)
      }
    });

    // Test password comparison
    console.log('\nTesting password comparison...');
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log('Password comparison result:', {
      testPassword,
      matches: isMatch
    });

    // If password doesn't match, try to identify why
    if (!isMatch) {
      console.log('\nDiagnostic information:');
      console.log('1. Is password properly hashed?', user.password.startsWith('$2'));
      console.log('2. Hash format correct?', /^\$2[aby]\$\d{2}\$/.test(user.password));
      console.log('3. Hash length correct?', user.password.length >= 59 && user.password.length <= 61);
      
      // Try hashing the test password to compare formats
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('\nComparing hash formats:');
      console.log('Stored hash format:', user.password.substring(0, 7) + '...');
      console.log('Test hash format:', newHash.substring(0, 7) + '...');
    }

  } catch (error) {
    console.error('Error verifying password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Get email and test password from command line arguments
const email = process.argv[2];
const testPassword = process.argv[3];

if (!email || !testPassword) {
  console.log('Usage: node verifyUserPassword.js <email> <password>');
  process.exit(1);
}

verifyUserPassword(email, testPassword); 