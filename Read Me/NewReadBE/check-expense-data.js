require('dotenv').config();
const mongoose = require('mongoose');
const ExpenseClaim = require('./src/models/ExpenseClaim');
const Organization = require('./src/models/Organization');

async function checkExpenseData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');
    
    // Check total expense claims
    const totalClaims = await ExpenseClaim.countDocuments();
    console.log('Total expense claims:', totalClaims);
    
    // Check approved claims
    const approvedClaims = await ExpenseClaim.countDocuments({ status: 'Approved' });
    console.log('Approved expense claims:', approvedClaims);
    
    // Check total amount of approved claims
    const approvedAmount = await ExpenseClaim.aggregate([
      { $match: { status: 'Approved' } },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    console.log('Total approved amount:', approvedAmount[0]?.totalAmount || 0);
    
    // Check by organization
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
          totalClaims: { $sum: 1 },
          approvedClaims: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
          totalAmount: { $sum: '$totalAmount' },
          approvedAmount: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$totalAmount', 0] } }
        }
      },
      { $sort: { totalClaims: -1 } }
    ]);
    
    console.log('\nBreakdown by Organization:');
    orgBreakdown.forEach(org => {
      console.log(`- ${org.orgName || 'Unknown'}: ${org.totalClaims} total (${org.approvedClaims} approved)`);
      console.log(`  Total Amount: QAR ${org.totalAmount.toFixed(2)}`);
      console.log(`  Approved Amount: QAR ${org.approvedAmount.toFixed(2)}`);
    });
    
    // Check current year approved claims
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const yearlyApproved = await ExpenseClaim.aggregate([
      { 
        $match: { 
          status: 'Approved',
          createdAt: { $gte: startOfYear }
        } 
      },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    console.log(`\nCurrent year (${currentYear}) approved amount: QAR ${yearlyApproved[0]?.totalAmount || 0}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkExpenseData();