require('dotenv').config();
const mongoose = require('mongoose');
const ExpenseClaim = require('./src/models/ExpenseClaim');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

// Mock data for expense claims
const expenseCategories = [
  'Travel',
  'Meals & Entertainment',
  'Office Supplies',
  'Transportation',
  'Accommodation',
  'Training & Development',
  'Communication',
  'Equipment',
  'Marketing',
  'Professional Services'
];

// Sample expense templates for different categories
const expenseTemplates = {
  'Travel': [
    { description: 'Flight ticket - Doha to Dubai', amount: 1200, currency: 'QAR' },
    { description: 'Airport taxi fare', amount: 150, currency: 'QAR' },
    { description: 'Travel insurance', amount: 80, currency: 'QAR' },
    { description: 'Airport parking', amount: 60, currency: 'QAR' }
  ],
  'Meals & Entertainment': [
    { description: 'Client lunch meeting', amount: 250, currency: 'QAR' },
    { description: 'Team dinner', amount: 400, currency: 'QAR' },
    { description: 'Coffee meeting with vendor', amount: 45, currency: 'QAR' },
    { description: 'Business lunch', amount: 180, currency: 'QAR' }
  ],
  'Office Supplies': [
    { description: 'Printer paper (A4)', amount: 120, currency: 'QAR' },
    { description: 'Stationery set', amount: 85, currency: 'QAR' },
    { description: 'Whiteboard markers', amount: 35, currency: 'QAR' },
    { description: 'File folders', amount: 60, currency: 'QAR' }
  ],
  'Transportation': [
    { description: 'Taxi fare to client meeting', amount: 45, currency: 'QAR' },
    { description: 'Uber ride to office', amount: 25, currency: 'QAR' },
    { description: 'Car rental for business trip', amount: 300, currency: 'QAR' },
    { description: 'Fuel for business travel', amount: 80, currency: 'QAR' }
  ],
  'Accommodation': [
    { description: 'Hotel stay - Business trip', amount: 800, currency: 'QAR' },
    { description: 'Conference accommodation', amount: 1200, currency: 'QAR' },
    { description: 'Extended stay hotel', amount: 600, currency: 'QAR' }
  ],
  'Training & Development': [
    { description: 'Online course subscription', amount: 200, currency: 'QAR' },
    { description: 'Conference registration fee', amount: 500, currency: 'QAR' },
    { description: 'Professional certification exam', amount: 350, currency: 'QAR' },
    { description: 'Training materials', amount: 150, currency: 'QAR' }
  ],
  'Communication': [
    { description: 'Mobile phone bill (business)', amount: 120, currency: 'QAR' },
    { description: 'Internet service (home office)', amount: 200, currency: 'QAR' },
    { description: 'Video conferencing software', amount: 80, currency: 'QAR' }
  ],
  'Equipment': [
    { description: 'Laptop repair service', amount: 300, currency: 'QAR' },
    { description: 'Office chair replacement', amount: 450, currency: 'QAR' },
    { description: 'Monitor upgrade', amount: 600, currency: 'QAR' },
    { description: 'Software license renewal', amount: 250, currency: 'QAR' }
  ],
  'Marketing': [
    { description: 'Digital marketing campaign', amount: 1000, currency: 'QAR' },
    { description: 'Print advertising', amount: 800, currency: 'QAR' },
    { description: 'Social media promotion', amount: 300, currency: 'QAR' },
    { description: 'Event booth rental', amount: 1500, currency: 'QAR' }
  ],
  'Professional Services': [
    { description: 'Legal consultation', amount: 500, currency: 'QAR' },
    { description: 'Accounting services', amount: 300, currency: 'QAR' },
    { description: 'IT support contract', amount: 400, currency: 'QAR' },
    { description: 'Consulting fees', amount: 1200, currency: 'QAR' }
  ]
};

// Sample titles for expense claims
const expenseTitles = [
  'Business Trip to Dubai',
  'Client Meeting Expenses',
  'Office Supplies Purchase',
  'Training Conference Attendance',
  'Marketing Campaign Costs',
  'Equipment Maintenance',
  'Team Building Event',
  'Professional Development Course',
  'Vendor Meeting Expenses',
  'Project Implementation Costs',
  'Staff Training Workshop',
  'Business Development Activities',
  'IT Infrastructure Upgrade',
  'Customer Service Training',
  'Sales Meeting Expenses'
];

// Sample justifications
const justifications = [
  'Required for client presentation and business development',
  'Essential for project completion and delivery',
  'Necessary for team productivity and efficiency',
  'Mandatory training for compliance and certification',
  'Critical for maintaining business operations',
  'Required for expanding market reach and visibility',
  'Essential for staff development and skill enhancement',
  'Necessary for maintaining professional standards',
  'Required for client relationship management',
  'Critical for business growth and expansion'
];

// Generate random date within a range
function getRandomDate(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate itemized expenses for a category
function generateItemizedExpenses(category) {
  const templates = expenseTemplates[category] || expenseTemplates['Office Supplies'];
  const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items
  const selectedItems = [];
  
  for (let i = 0; i < numItems; i++) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const variation = 0.8 + Math.random() * 0.4; // ±20% variation
    selectedItems.push({
      description: template.description,
      amount: Math.round(template.amount * variation),
      currency: template.currency,
      notes: Math.random() > 0.7 ? 'Additional notes for this expense' : undefined
    });
  }
  
  return selectedItems;
}

// Generate mock receipt data
function generateMockReceipts() {
  const receiptTypes = [
    { filename: 'receipt_001.pdf', originalname: 'taxi_receipt.pdf', mimetype: 'application/pdf', size: 245760 },
    { filename: 'receipt_002.jpg', originalname: 'restaurant_bill.jpg', mimetype: 'image/jpeg', size: 512000 },
    { filename: 'receipt_003.png', originalname: 'hotel_invoice.png', mimetype: 'image/png', size: 384000 },
    { filename: 'receipt_004.pdf', originalname: 'flight_ticket.pdf', mimetype: 'application/pdf', size: 128000 }
  ];
  
  const numReceipts = Math.floor(Math.random() * 3) + 1; // 1-3 receipts
  const receipts = [];
  
  for (let i = 0; i < numReceipts; i++) {
    const receipt = receiptTypes[Math.floor(Math.random() * receiptTypes.length)];
    receipts.push({
      ...receipt,
      filename: `receipt_${Date.now()}_${i}.${receipt.filename.split('.').pop()}`,
      url: `https://example.com/receipts/${receipt.filename}`
    });
  }
  
  return receipts;
}

async function seedExpenseClaims() {
  try {
    console.log('🚀 Starting Expense Claims Seeding Script...');
    console.log('📋 This will create comprehensive mock data for Expense Claims module');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('✅ Connected to MongoDB');

    // Get organizations and staff
    const organizations = await Organization.find({}, 'name _id');
    const staff = await User.find({ role: 'staff', status: 'active' }, 'fullName email department organization');
    const admins = await User.find({ role: 'admin', status: 'active' }, 'fullName email organization');

    console.log(`📊 Found ${organizations.length} organization(s), ${staff.length} staff members, and ${admins.length} admins`);

    let totalClaims = 0;

    for (const org of organizations) {
      console.log(`\n🏢 Processing organization: ${org.name} (${org._id})`);
      
      const orgStaff = staff.filter(s => s.organization.toString() === org._id.toString());
      const orgAdmins = admins.filter(a => a.organization.toString() === org._id.toString());
      
      console.log(`👥 Found ${orgStaff.length} staff members and ${orgAdmins.length} admins in this organization`);

      if (orgStaff.length === 0) {
        console.log(`   ⚠️  Skipping ${org.name} - no staff members`);
        continue;
      }

      // Generate expense claims for different time periods
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      // Generate claims for the last 12 months
      for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
        const claimDate = new Date(currentYear, currentMonth - monthOffset, 1);
        const monthStart = new Date(claimDate.getFullYear(), claimDate.getMonth(), 1);
        const monthEnd = new Date(claimDate.getFullYear(), claimDate.getMonth() + 1, 0);
        
        // Generate 2-5 claims per month
        const claimsPerMonth = Math.floor(Math.random() * 4) + 2;
        
        for (let i = 0; i < claimsPerMonth; i++) {
          const requester = orgStaff[Math.floor(Math.random() * orgStaff.length)];
          const category = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
          const title = expenseTitles[Math.floor(Math.random() * expenseTitles.length)];
          const justification = justifications[Math.floor(Math.random() * justifications.length)];
          
          // Generate expense date within the month
          const expenseDate = getRandomDate(monthStart, monthEnd);
          
          // Generate itemized expenses
          const itemizedExpenses = generateItemizedExpenses(category);
          const totalAmount = itemizedExpenses.reduce((sum, item) => sum + item.amount, 0);
          
          // Generate mock receipts
          const receipts = generateMockReceipts();
          
          // Determine status: 30% pending, 50% approved, 20% rejected
          const statusRand = Math.random();
          let status, submittedAt, decisionDate, approvedRejectedBy, approvalLogs;
          
          if (statusRand < 0.3) {
            status = 'Pending';
            submittedAt = new Date(expenseDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // Within 7 days
            approvalLogs = [{
              status: 'Pending',
              adminId: null,
              comment: 'Claim submitted for review',
              date: submittedAt
            }];
          } else if (statusRand < 0.8) {
            status = 'Approved';
            submittedAt = new Date(expenseDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
            decisionDate = new Date(submittedAt.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000); // Within 14 days
            approvedRejectedBy = orgAdmins.length > 0 ? orgAdmins[Math.floor(Math.random() * orgAdmins.length)]._id : null;
            approvalLogs = [
              {
                status: 'Pending',
                adminId: null,
                comment: 'Claim submitted for review',
                date: submittedAt
              },
              {
                status: 'Approved',
                adminId: approvedRejectedBy,
                comment: 'Expense approved - all receipts verified',
                date: decisionDate
              }
            ];
          } else {
            status = 'Rejected';
            submittedAt = new Date(expenseDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
            decisionDate = new Date(submittedAt.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000);
            approvedRejectedBy = orgAdmins.length > 0 ? orgAdmins[Math.floor(Math.random() * orgAdmins.length)]._id : null;
            approvalLogs = [
              {
                status: 'Pending',
                adminId: null,
                comment: 'Claim submitted for review',
                date: submittedAt
              },
              {
                status: 'Rejected',
                adminId: approvedRejectedBy,
                comment: 'Expense rejected - insufficient documentation or policy violation',
                date: decisionDate
              }
            ];
          }

          const expenseClaim = new ExpenseClaim({
            staffId: requester._id,
            organization: org._id,
            title: title,
            expenseDate: expenseDate,
            category: category,
            itemizedExpenses: itemizedExpenses,
            totalAmount: totalAmount,
            receipts: receipts,
            justification: justification,
            declaration: true,
            status: status,
            approvalLogs: approvalLogs,
            submittedAt: submittedAt,
            decisionDate: decisionDate,
            approvedRejectedBy: approvedRejectedBy
          });

          await expenseClaim.save();
          totalClaims++;
        }
      }

      console.log(`✅ Completed ${org.name}: ${totalClaims} expense claims created`);
    }

    console.log('\n🎉 Expense claims seeding completed!');
    console.log('📊 Summary:');
    console.log(`   • Total expense claims created: ${totalClaims}`);

    // Show sample data
    console.log('\n📋 Sample of created data:');
    const sampleClaims = await ExpenseClaim.find({})
      .populate('staffId', 'fullName department')
      .populate('approvedRejectedBy', 'fullName')
      .populate('organization', 'name')
      .limit(5);
    
    sampleClaims.forEach(claim => {
      console.log(`   • ${claim.title} (${claim.category})`);
      console.log(`     Amount: ${claim.totalAmount} QAR | Status: ${claim.status}`);
      console.log(`     Staff: ${claim.staffId.fullName} (${claim.staffId.department})`);
      console.log(`     Date: ${claim.expenseDate.toLocaleDateString()}`);
      if (claim.approvedRejectedBy) {
        console.log(`     Decided by: ${claim.approvedRejectedBy.fullName}`);
      }
      console.log(`     Organization: ${claim.organization.name}`);
      console.log('');
    });

    // Show status distribution
    const statusCounts = await ExpenseClaim.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('📊 Status Distribution:');
    statusCounts.forEach(status => {
      console.log(`   • ${status._id}: ${status.count}`);
    });

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedExpenseClaims();




