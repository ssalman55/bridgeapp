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

// Debug payroll data
async function debugPayrollData() {
  try {
    await connectDB();
    
    console.log('🔍 Debugging Payroll Data...');
    
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
    }).select('payPeriod netSalary grossSalary createdAt').sort({ payPeriod: -1 });
    
    console.log(`\n📈 Total Payroll Records: ${allPayrolls.length}`);
    
    if (allPayrolls.length > 0) {
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
      
      // Test current year filter
      const currentYear = new Date().getFullYear();
      const currentYearPayrolls = allPayrolls.filter(p => p.payPeriod && p.payPeriod.startsWith(`${currentYear}-`));
      const currentYearTotal = currentYearPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
      
      console.log(`\n🎯 Current Year (${currentYear}) Filter:`);
      console.log(`  Records: ${currentYearPayrolls.length}`);
      console.log(`  Total: $${currentYearTotal}`);
      
      // Test "all" filter (no date restriction)
      console.log(`\n🌍 All Time Filter:`);
      console.log(`  Records: ${allPayrolls.length}`);
      console.log(`  Total: $${totalNetSalary}`);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugPayrollData();







