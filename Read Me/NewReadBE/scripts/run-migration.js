#!/usr/bin/env node

// Simple migration runner for Render.com
require('dotenv').config();
const mongoose = require('mongoose');

console.log('🚀 Starting payslip migration on Render.com...');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
  
  // Import and run the migration
  require('./generate-existing-payslips.js');
}).catch((error) => {
  console.error('❌ Failed to connect to MongoDB:', error.message);
  process.exit(1);
}); 