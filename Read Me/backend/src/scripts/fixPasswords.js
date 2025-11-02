const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// MongoDB connection string - replace with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge';

async function fixPasswords() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find().select('+password');
    console.log(`Found ${users.length} users`);

    let fixedCount = 0;
    let alreadyHashedCount = 0;

    for (const user of users) {
      // Try to determine if the password is already hashed
      // bcrypt hashes are ~60 characters and start with $2a$, $2b$, or $2y$
      const isHashed = user.password.length > 40 && /^\$2[aby]\$/.test(user.password);

      if (!isHashed) {
        console.log(`Fixing unhashed password for user: ${user.email}`);
        // Hash the plain password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        await user.save();
        fixedCount++;
      } else {
        alreadyHashedCount++;
      }
    }

    console.log('Password fix complete:');
    console.log(`- ${fixedCount} passwords were hashed`);
    console.log(`- ${alreadyHashedCount} passwords were already hashed`);
    console.log(`- ${users.length} total users processed`);

  } catch (error) {
    console.error('Error fixing passwords:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixPasswords(); 