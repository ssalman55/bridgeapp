require('dotenv').config();
const mongoose = require('mongoose');
const PayrollRun = require('./src/models/PayrollRun');
const Organization = require('./src/models/Organization');
const User = require('./src/models/User');

async function testControllerBinding() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Test the controller binding
    const enhancedPayrollController = require('./src/controllers/enhancedPayrollController');
    
    console.log('Testing controller method binding...');
    
    // Check if methods exist and are bound properly
    console.log('generateWPSFile method:', typeof enhancedPayrollController.generateWPSFile);
    console.log('getPayrollData method:', typeof enhancedPayrollController.getPayrollData);
    console.log('getWPSCountries method:', typeof enhancedPayrollController.getWPSCountries);
    console.log('getBankPresets method:', typeof enhancedPayrollController.getBankPresets);
    
    // Test if getPayrollData can be called
    try {
      const testData = await enhancedPayrollController.getPayrollData('68a7709feb5ba8ce200dfe0b', '2025-01');
      console.log('✅ getPayrollData method works!');
      console.log(`Found ${testData.length} payroll records`);
    } catch (error) {
      console.log('❌ getPayrollData method error:', error.message);
    }
    
    console.log('\n✅ Controller binding test completed!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing controller binding:', error);
    process.exit(1);
  }
}

testControllerBinding();








