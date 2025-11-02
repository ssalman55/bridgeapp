require('dotenv').config();
const mongoose = require('mongoose');
const ExpenseClaim = require('./src/models/ExpenseClaim');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function testExpenseClaimsSeeding() {
  try {
    console.log('🔍 Testing Expense Claims Seeding Results...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('✅ Connected to MongoDB');

    // Get counts
    const claimsCount = await ExpenseClaim.countDocuments();
    const orgsCount = await Organization.countDocuments();

    console.log(`📊 Found ${orgsCount} organization(s)`);
    console.log(`💰 Found ${claimsCount} expense claims`);

    // Test by organization
    const organizations = await Organization.find({}, 'name _id');
    
    for (const org of organizations) {
      console.log(`\n🏢 Organization: ${org.name}`);
      
      const orgClaims = await ExpenseClaim.countDocuments({ organization: org._id });
      console.log(`   • Total claims: ${orgClaims}`);

      if (orgClaims > 0) {
        // Check claim statuses
        const statusCounts = await ExpenseClaim.aggregate([
          { $match: { organization: org._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        console.log(`   • Claim statuses:`);
        statusCounts.forEach(status => {
          console.log(`     - ${status._id}: ${status.count}`);
        });

        // Check categories
        const categoryCounts = await ExpenseClaim.aggregate([
          { $match: { organization: org._id } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        
        console.log(`   • Top categories:`);
        categoryCounts.slice(0, 5).forEach(category => {
          console.log(`     - ${category._id}: ${category.count}`);
        });

        // Check monthly distribution
        const monthlyCounts = await ExpenseClaim.aggregate([
          { $match: { organization: org._id } },
          { $group: { 
              _id: { 
                year: { $year: '$expenseDate' }, 
                month: { $month: '$expenseDate' } 
              }, 
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' }
            } 
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 6 }
        ]);
        
        console.log(`   • Recent months:`);
        monthlyCounts.forEach(month => {
          const monthName = new Date(month._id.year, month._id.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          console.log(`     - ${monthName}: ${month.count} claims, ${month.totalAmount} QAR`);
        });
      }
    }

    // Show sample data
    console.log('\n📋 Sample expense claims:');
    const sampleClaims = await ExpenseClaim.find({})
      .populate('staffId', 'fullName department')
      .populate('approvedRejectedBy', 'fullName')
      .populate('organization', 'name')
      .sort({ expenseDate: -1 })
      .limit(5);
    
    sampleClaims.forEach(claim => {
      console.log(`   • ${claim.title} (${claim.category})`);
      console.log(`     Amount: ${claim.totalAmount} QAR | Status: ${claim.status}`);
      console.log(`     Staff: ${claim.staffId.fullName} (${claim.staffId.department})`);
      console.log(`     Date: ${claim.expenseDate.toLocaleDateString()}`);
      console.log(`     Items: ${claim.itemizedExpenses.length} expenses`);
      if (claim.approvedRejectedBy) {
        console.log(`     Decided by: ${claim.approvedRejectedBy.fullName}`);
      }
      console.log(`     Organization: ${claim.organization.name}`);
      console.log('');
    });

    // Test summary
    console.log('🎯 Testing Summary:');
    console.log(`✅ Total expense claims created: ${claimsCount}`);
    
    const pendingClaims = await ExpenseClaim.countDocuments({ status: 'Pending' });
    const approvedClaims = await ExpenseClaim.countDocuments({ status: 'Approved' });
    const rejectedClaims = await ExpenseClaim.countDocuments({ status: 'Rejected' });
    
    console.log(`✅ Pending claims: ${pendingClaims}`);
    console.log(`✅ Approved claims: ${approvedClaims}`);
    console.log(`✅ Rejected claims: ${rejectedClaims}`);
    
    // Check time distribution
    const currentYear = new Date().getFullYear();
    const currentYearClaims = await ExpenseClaim.countDocuments({
      expenseDate: { $gte: new Date(currentYear, 0, 1), $lt: new Date(currentYear + 1, 0, 1) }
    });
    
    const lastYearClaims = await ExpenseClaim.countDocuments({
      expenseDate: { $gte: new Date(currentYear - 1, 0, 1), $lt: new Date(currentYear, 0, 1) }
    });
    
    console.log(`✅ Current year claims: ${currentYearClaims}`);
    console.log(`✅ Last year claims: ${lastYearClaims}`);
    
    // Check total amounts
    const totalAmounts = await ExpenseClaim.aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    
    if (totalAmounts.length > 0) {
      console.log(`✅ Total amount across all claims: ${totalAmounts[0].totalAmount} QAR`);
    }
    
    console.log('\n🎉 Expense claims seeding test completed successfully!');
    console.log('💡 The Expense Claims module should now have comprehensive test data for:');
    console.log('   • Pending Claims page');
    console.log('   • Approved Claims page');
    console.log('   • Monthly Expense reports');
    console.log('   • Yearly Expense reports');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testExpenseClaimsSeeding();




