const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Debug netSalary values specifically
async function debugNetSalaryValues() {
  try {
    await connectDB();
    
    console.log('🔍 Debugging netSalary Values...');
    
    const Payroll = require('./src/models/Payroll');
    const Organization = require('./src/models/Organization');
    
    // Find head office organization
    const headOffice = await Organization.findOne({ 
      organizationType: 'head-office' 
    });
    
    if (!headOffice) {
      console.log('❌ No head office found');
      return;
    }
    
    console.log(`📊 Head Office: ${headOffice.name} (${headOffice._id})`);
    
    // Test the exact aggregation query the dashboard uses
    const currentYear = new Date().getFullYear();
    const payrollQuery = { 
      organization: headOffice._id, 
      payPeriod: { $regex: `^${currentYear}-` } 
    };
    
    console.log(`\n🔍 Testing Dashboard Aggregation Query:`);
    console.log(`Query:`, JSON.stringify(payrollQuery, null, 2));
    
    // Test the aggregation
    const payrollAggregation = await Payroll.aggregate([
      { $match: payrollQuery },
      { $group: { _id: null, totalAmount: { $sum: '$netSalary' } } }
    ]);
    
    console.log(`Aggregation Result:`, payrollAggregation);
    const totalAmount = payrollAggregation[0]?.totalAmount || 0;
    console.log(`Total Amount from Aggregation: $${totalAmount}`);
    
    // Check individual netSalary values
    const samplePayrolls = await Payroll.find(payrollQuery).limit(10).select('netSalary grossSalary payPeriod');
    console.log(`\n📋 Sample netSalary Values:`);
    samplePayrolls.forEach((p, i) => {
      console.log(`  ${i+1}. Period: ${p.payPeriod}, netSalary: ${p.netSalary} (type: ${typeof p.netSalary}), grossSalary: ${p.grossSalary}`);
    });
    
    // Check for null/undefined values
    const nullNetSalary = await Payroll.countDocuments({ 
      ...payrollQuery, 
      $or: [
        { netSalary: null }, 
        { netSalary: undefined },
        { netSalary: { $exists: false } }
      ]
    });
    
    console.log(`\n🚨 Records with null/undefined netSalary: ${nullNetSalary}`);
    
    // Check for zero values
    const zeroNetSalary = await Payroll.countDocuments({ 
      ...payrollQuery, 
      netSalary: 0 
    });
    
    console.log(`🚨 Records with zero netSalary: ${zeroNetSalary}`);
    
    // Manual calculation
    const allPayrolls = await Payroll.find(payrollQuery);
    const manualTotal = allPayrolls.reduce((sum, p) => {
      const netSalary = p.netSalary || 0;
      return sum + netSalary;
    }, 0);
    
    console.log(`\n🧮 Manual Calculation:`);
    console.log(`  Records processed: ${allPayrolls.length}`);
    console.log(`  Manual total: $${manualTotal}`);
    console.log(`  Aggregation total: $${totalAmount}`);
    console.log(`  Match: ${manualTotal === totalAmount ? '✅' : '❌'}`);
    
    // Test with grossSalary instead
    const grossAggregation = await Payroll.aggregate([
      { $match: payrollQuery },
      { $group: { _id: null, totalAmount: { $sum: '$grossSalary' } } }
    ]);
    
    const grossTotal = grossAggregation[0]?.totalAmount || 0;
    console.log(`\n💰 Gross Salary Total: $${grossTotal}`);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugNetSalaryValues();







