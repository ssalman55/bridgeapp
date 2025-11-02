require('dotenv').config();
const mongoose = require('mongoose');
const ExpenseClaim = require('./src/models/ExpenseClaim');
const Organization = require('./src/models/Organization');

async function analyzeExpenseData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');
    
    // Get all organizations
    const organizations = await Organization.find({}, 'name organizationType parentHeadOffice linkedBranches');
    console.log('\n=== ORGANIZATIONS ===');
    organizations.forEach(org => {
      console.log(`- ${org.name} (${org.organizationType || 'standalone'})`);
      console.log(`  ID: ${org._id}`);
      if (org.parentHeadOffice) {
        console.log(`  Parent Head Office: ${org.parentHeadOffice}`);
      }
      if (org.linkedBranches && org.linkedBranches.length > 0) {
        console.log(`  Linked Branches: ${org.linkedBranches.length}`);
      }
    });
    
    // Check expense claims by organization
    console.log('\n=== EXPENSE CLAIMS BY ORGANIZATION ===');
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
          orgType: { $first: { $arrayElemAt: ['$orgData.organizationType', 0] } },
          totalClaims: { $sum: 1 },
          approvedClaims: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
          totalAmount: { $sum: '$totalAmount' },
          approvedAmount: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$totalAmount', 0] } }
        }
      },
      { $sort: { totalClaims: -1 } }
    ]);
    
    orgBreakdown.forEach(org => {
      console.log(`- ${org.orgName || 'Unknown'} (${org.orgType || 'standalone'})`);
      console.log(`  ID: ${org._id}`);
      console.log(`  Total Claims: ${org.totalClaims} (${org.approvedClaims} approved)`);
      console.log(`  Total Amount: QAR ${org.totalAmount.toFixed(2)}`);
      console.log(`  Approved Amount: QAR ${org.approvedAmount.toFixed(2)}`);
    });
    
    // Check current year approved claims
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    console.log(`\n=== CURRENT YEAR (${currentYear}) APPROVED CLAIMS ===`);
    
    const yearlyApproved = await ExpenseClaim.aggregate([
      { 
        $match: { 
          status: 'Approved',
          createdAt: { $gte: startOfYear }
        } 
      },
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
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    yearlyApproved.forEach(org => {
      console.log(`- ${org.orgName || 'Unknown'}: ${org.count} claims, QAR ${org.totalAmount.toFixed(2)}`);
    });
    
    const totalYearlyApproved = yearlyApproved.reduce((sum, org) => sum + org.totalAmount, 0);
    console.log(`\nTOTAL CURRENT YEAR APPROVED: QAR ${totalYearlyApproved.toFixed(2)}`);
    
    // Check which organization is the head office
    const headOffices = organizations.filter(org => org.organizationType === 'head-office');
    console.log('\n=== HEAD OFFICE ORGANIZATIONS ===');
    headOffices.forEach(org => {
      console.log(`- ${org.name} (ID: ${org._id})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

analyzeExpenseData();








