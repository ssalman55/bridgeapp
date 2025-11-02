const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use MongoDB Atlas connection string from environment variable, fallback to provided Atlas string, then to localhost
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb+srv://ssalman55:Acsdoha123@cluster0.uermh2b.mongodb.net/' || 'mongodb://localhost:27017/staffbridge'
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 