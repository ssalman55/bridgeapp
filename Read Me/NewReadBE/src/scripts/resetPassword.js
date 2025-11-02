const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('MongoDB Connected');
    return conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const resetPassword = async () => {
  try {
    await connectDB();
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('staff123', salt);
    
    // Update user password
    const user = await User.findOneAndUpdate(
      { email: 'sa@example.com' },
      { password: hashedPassword },
      { new: true }
    );

    if (user) {
      console.log('Password reset successful for:', user.email);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await mongoose.disconnect();
  }
};

resetPassword(); 