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

// Debug payroll data and dashboard query
async function debugPayrollDashboard() {
  try {
    await connectDB();
    
    console.log('🔍 Debugging Payroll Dashboard Issue...');
    
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
    
    // Get all payroll records for this organization
    const allPayrolls = await Payroll.find({ 
      organization: headOffice._id 
    }).select('payPeriod netSalary grossSalary createdAt organization').sort({ payPeriod: -1 });
    
    console.log(`\n📈 Total Payroll Records: ${allPayrolls.length}`);
    
    if (allPayrolls.length === 0) {
      console.log('❌ NO PAYROLL RECORDS FOUND!');
      console.log('This explains why Total Payroll shows $0.00');
      
      // Check if there are any payroll records at all
      const anyPayrolls = await Payroll.find({}).limit(5);
      console.log(`\n🔍 Checking for ANY payroll records in database: ${anyPayrolls.length}`);
      if (anyPayrolls.length > 0) {
        console.log('Sample payroll records:');
        anyPayrolls.forEach((p, i) => {
          console.log(`  ${i+1}. Org: ${p.organization}, Period: ${p.payPeriod}, Net: $${p.netSalary}`);
        });
      }
      return;
    }
    
    console.log('\n📋 Payroll Records Sample:');
    allPayrolls.slice(0, 5).forEach((payroll, index) => {
      console.log(`  ${index + 1}. Period: ${payroll.payPeriod}, Net: $${payroll.netSalary}, Gross: $${payroll.grossSalary}`);
    });
    
    // Check unique pay periods
    const uniquePeriods = [...new Set(allPayrolls.map(p => p.payPeriod))];
    console.log(`\n📅 Unique Pay Periods (${uniquePeriods.length}):`);
    uniquePeriods.slice(0, 10).forEach(period => {
      console.log(`  - ${period}`);
    });
    
    // Calculate total amounts
    const totalNetSalary = allPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    const totalGrossSalary = allPayrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
    
    console.log(`\n💰 Total Amounts:`);
    console.log(`  Net Salary: $${totalNetSalary}`);
    console.log(`  Gross Salary: $${totalGrossSalary}`);
    
    // Test current year filter (this is what the dashboard uses)
    const currentYear = new Date().getFullYear();
    const currentYearPayrolls = allPayrolls.filter(p => p.payPeriod && p.payPeriod.startsWith(`${currentYear}-`));
    const currentYearTotal = currentYearPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    
    console.log(`\n🎯 Current Year (${currentYear}) Filter:`);
    console.log(`  Records: ${currentYearPayrolls.length}`);
    console.log(`  Total: $${currentYearTotal}`);
    
    // Test the exact query the dashboard uses
    console.log(`\n🔍 Testing Dashboard Query Logic:`);
    
    // Simulate the dashboard query
    const dateRange = 'year'; // This is what the dashboard uses
    let payrollDateFilter = {};
    
    if (dateRange === 'year') {
      payrollDateFilter = { payPeriod: { $regex: `^${currentYear}-` } };
    }
    
    const payrollQuery = { organization: headOffice._id, ...payrollDateFilter };
    console.log(`Dashboard Query:`, JSON.stringify(payrollQuery, null, 2));
    
    const dashboardPayrolls = await Payroll.find(payrollQuery);
    const dashboardTotal = dashboardPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    
    console.log(`Dashboard Results:`);
    console.log(`  Records found: ${dashboardPayrolls.length}`);
    console.log(`  Total amount: $${dashboardTotal}`);
    
    if (dashboardTotal === 0) {
      console.log(`\n🚨 ISSUE FOUND: Dashboard query returns $0.00`);
      console.log(`This is why the dashboard shows $0.00`);
      
      // Test the fallback logic
      console.log(`\n🔄 Testing Fallback Logic (all-time data):`);
      const allTimeQuery = { organization: headOffice._id };
      const allTimePayrolls = await Payroll.find(allTimeQuery);
      const allTimeTotal = allTimePayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
      
      console.log(`All-time query results:`);
      console.log(`  Records: ${allTimePayrolls.length}`);
      console.log(`  Total: $${allTimeTotal}`);
      
      if (allTimeTotal > 0) {
        console.log(`✅ Fallback logic should work - all-time data exists`);
        console.log(`The fix should show $${allTimeTotal} instead of $0.00`);
      } else {
        console.log(`❌ Even all-time data is $0.00 - check netSalary values`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugPayrollDashboard();







