#!/usr/bin/env node

/**
 * Clear Mock Expense Claims Data
 * 
 * This script removes all seeded/mock expense claims from the database
 * to allow for clean testing with real user-created expense data.
 * 
 * WARNING: This will delete ALL expense claims in the database.
 * Make sure this is what you want before running.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ExpenseClaim = require('./src/models/ExpenseClaim');

async function clearExpenseClaims() {
  try {
    console.log('🚀 Starting Expense Claims Data Cleanup...');
    console.log('⚠️  WARNING: This will delete ALL expense claims in the database');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Get current count before deletion
    const currentCount = await ExpenseClaim.countDocuments();
    console.log(`\n📊 Current Status:`);
    console.log(`   • Total expense claims in database: ${currentCount}`);

    if (currentCount === 0) {
      console.log('\n✨ Database is already clean - no expense claims to delete');
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
      return;
    }

    // Show breakdown by organization before deletion
    const orgBreakdown = await ExpenseClaim.aggregate([
      {
        $lookup: {
          from: 'organizations',
          localField: 'organization',
          foreignField: '_id',
          as: 'orgData'
        }
      },
      {
        $group: {
          _id: '$organization',
          orgName: { $first: { $arrayElemAt: ['$orgData.name', 0] } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          approvedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$totalAmount', 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n📋 Breakdown by Organization (Before Deletion):`);
    orgBreakdown.forEach(org => {
      console.log(`   • ${org.orgName || 'Unknown Org'}: ${org.count} claims (${org.approvedCount} approved)`);
      console.log(`     Total Amount: QAR ${org.totalAmount.toFixed(2)}`);
      console.log(`     Approved Amount: QAR ${org.approvedAmount.toFixed(2)}`);
    });

    // Delete all expense claims
    console.log(`\n🗑️  Deleting all expense claims...`);
    const deleteResult = await ExpenseClaim.deleteMany({});
    
    console.log(`\n✅ Successfully deleted ${deleteResult.deletedCount} expense claims`);
    
    // Verify deletion
    const remainingCount = await ExpenseClaim.countDocuments();
    console.log(`\n📊 Final Status:`);
    console.log(`   • Remaining expense claims: ${remainingCount}`);

    if (remainingCount === 0) {
      console.log('\n🎉 Database cleanup completed successfully!');
      console.log('📝 The Head Office Dashboard will now show $0.00 for expense costs');
      console.log('💡 Real expense costs will appear as users create actual expense claims');
    } else {
      console.log('\n⚠️  Warning: Some expense claims may still exist');
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

clearExpenseClaims();









