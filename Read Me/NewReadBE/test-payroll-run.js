require('dotenv').config();
const mongoose = require('mongoose');
const PayrollRun = require('./src/models/PayrollRun');
const Organization = require('./src/models/Organization');
const User = require('./src/models/User');

async function testPayrollRunCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Get test data
    const organization = await Organization.findOne({ email: 'sahmad@acsdoha.school' });
    const user = await User.findOne({ role: 'admin' });
    
    if (!organization || !user) {
      console.error('Test data not found');
      process.exit(1);
    }

    console.log('Testing PayrollRun creation...');
    
    // Test the exact same structure as in the controller
    const testRun = new PayrollRun({
      runId: `PR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
      organization: organization._id,
      period: '2025-01',
      payDate: new Date(),
      currency: 'QAR',
      exportType: 'wps',
      country: 'Qatar',
      outputSettings: {
        packaging: 'single',
        encryption: { enabled: false },
        retentionDays: 90
      },
      status: 'draft',
      createdBy: user._id
    });

    await testRun.save();
    
    console.log('✅ PayrollRun created successfully!');
    console.log(`Run ID: ${testRun.runId}`);
    console.log(`Organization: ${organization.name}`);
    console.log(`Period: ${testRun.period}`);
    console.log(`Status: ${testRun.status}`);
    
    // Clean up
    await PayrollRun.deleteOne({ _id: testRun._id });
    console.log('✅ Test cleanup completed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing PayrollRun creation:', error);
    process.exit(1);
  }
}

testPayrollRunCreation();








