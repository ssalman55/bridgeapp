const mongoose = require('mongoose');
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

const listUsers = async () => {
  try {
    await connectDB();
    const users = await User.find({}).select('email fullName department role');
    console.log('\nUsers in database:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.fullName}) - ${user.role} in ${user.department}`);
    });
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await mongoose.disconnect();
  }
};

listUsers(); 