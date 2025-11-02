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

// Test dashboard performance
async function testDashboardPerformance() {
  try {
    await connectDB();
    
    console.log('🚀 Testing Head Office Dashboard Performance...');
    
    const startTime = Date.now();
    
    // Simulate the dashboard request
    const Organization = require('./src/models/Organization');
    const User = require('./src/models/User');
    
    // Find a head office organization
    const headOffice = await Organization.findOne({ 
      organizationType: 'head-office' 
    });
    
    if (!headOffice) {
      console.log('❌ No head office found');
      return;
    }
    
    console.log(`📊 Testing with Head Office: ${headOffice.name}`);
    
    // Get linked branches
    const linkedBranches = await Organization.find({ 
      parentHeadOffice: headOffice._id,
      organizationType: 'branch'
    }).select('name email plan linkingStatus linkedAt');
    
    console.log(`🔗 Found ${linkedBranches.length} linked branches`);
    
    const allOrgIds = [headOffice._id, ...linkedBranches.map(branch => branch._id)];
    
    // Test parallel vs sequential queries
    console.log('\n⏱️  Testing query performance...');
    
    // Sequential approach (current)
    const sequentialStart = Date.now();
    for (const orgId of allOrgIds) {
      await User.countDocuments({ organization: orgId });
      await User.countDocuments({ organization: orgId, isActive: { $ne: false } });
      await User.countDocuments({ organization: orgId, role: 'admin' });
      await User.countDocuments({ organization: orgId, role: 'staff' });
    }
    const sequentialTime = Date.now() - sequentialStart;
    
    // Parallel approach (optimized)
    const parallelStart = Date.now();
    await Promise.all(
      allOrgIds.map(async (orgId) => {
        const [total, active, admins, staff] = await Promise.all([
          User.countDocuments({ organization: orgId }),
          User.countDocuments({ organization: orgId, isActive: { $ne: false } }),
          User.countDocuments({ organization: orgId, role: 'admin' }),
          User.countDocuments({ organization: orgId, role: 'staff' })
        ]);
        return { orgId, total, active, admins, staff };
      })
    );
    const parallelTime = Date.now() - parallelStart;
    
    console.log(`\n📈 Performance Results:`);
    console.log(`   Sequential: ${sequentialTime}ms`);
    console.log(`   Parallel:   ${parallelTime}ms`);
    console.log(`   Improvement: ${Math.round(((sequentialTime - parallelTime) / sequentialTime) * 100)}%`);
    
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms`);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testDashboardPerformance();







