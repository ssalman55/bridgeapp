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

// Models
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');
const Attendance = require('./src/models/Attendance');
const LeaveRequest = require('./src/models/LeaveRequest');
const LeaveType = require('./src/models/LeaveType');
const Payroll = require('./src/models/Payroll');
const ExpenseClaim = require('./src/models/ExpenseClaim');
const HelpdeskTicket = require('./src/models/HelpdeskTicket');
const Event = require('./src/models/Event');
const InventoryItem = require('./src/models/InventoryItem');
const TrainingRequest = require('./src/models/TrainingRequest');
const PerformanceEvaluation = require('./src/models/PerformanceEvaluation');
const StaffBankDetails = require('./src/models/StaffBankDetails');
const HelpdeskCategory = require('./src/models/HelpdeskCategory');

// Helper functions for generating mock data
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica', 'William', 'Ashley', 'James', 'Amanda', 'Christopher', 'Michelle', 'Daniel', 'Laura', 'Matthew', 'Kimberly', 'Anthony', 'Nicole', 'Mark', 'Elizabeth', 'Donald', 'Angela', 'Steven', 'Samantha', 'Paul', 'Stephanie', 'Andrew', 'Rebecca', 'Joshua', 'Donna', 'Kenneth', 'Emma', 'Kevin', 'Rachel', 'Brian', 'Carolyn', 'George', 'Janet', 'Timothy', 'Catherine', 'Ronald', 'Deborah', 'Jason', 'Doris', 'Edward', 'Patricia', 'Jeffrey', 'Helen', 'Ryan', 'Nancy', 'Jacob', 'Betty', 'Gary', 'Sharon', 'Nicholas', 'Sandra', 'Eric', 'Carol'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher', 'Vasquez', 'Simmons', 'Romero', 'Jordan', 'Patterson', 'Alexander', 'Hamilton', 'Graham', 'Reynolds', 'Griffin', 'Wallace', 'Moreno', 'West', 'Cole', 'Hayes', 'Bryant', 'Herrera', 'Gibson', 'Ellis', 'Tran', 'Medina', 'Aguilar', 'Stevens', 'Murray', 'Ford', 'Castro', 'Marshall', 'Owens', 'Harrison', 'Fernandez', 'Mcdonald', 'Woods', 'Washington', 'Kennedy', 'Wells', 'Vargas', 'Henry', 'Chen', 'Freeman', 'Webb', 'Tucker', 'Guzman', 'Burns', 'Crawford', 'Olson', 'Simpson', 'Porter', 'Hunter', 'Gordon', 'Mendez', 'Silva', 'Shaw', 'Snyder', 'Mason', 'Dixon', 'Munoz', 'Hubbard', 'Hodges', 'Hatfield', 'Liu', 'Hanson', 'Zhang', 'Wilkinson', 'Harvey', 'Holland', 'Sherman', 'Garza', 'Barrett', 'Shen', 'Clayton', 'Cohen', 'Dunn', 'Mcgee', 'Middleton', 'Gross', 'Ware', 'Huffman', 'Knight', 'Vega', 'Vaughn', 'Ponce', 'Moss', 'Guzman', 'Nixon', 'Wolfe', 'Estrada', 'Pope', 'Osborne', 'Gilbert', 'Rowe', 'Franklin', 'Blair', 'Carson', 'Dudley', 'Lynch', 'Cannon', 'Hardy', 'Logan', 'Buck', 'Bishop', 'Farmer', 'Walsh', 'Keller', 'Cortez', 'Maldonado', 'Cunningham', 'Craig', 'Valdez', 'Benson', 'Bates', 'Lowe', 'Hines', 'Watts', 'Robbins', 'Meyer', 'Clay', 'Wolfe', 'Estrada'];

const departments = ['IT', 'HR', 'Finance', 'Operations', 'Sales', 'Marketing', 'Administration', 'Teaching', 'Support', 'Management', 'Legal', 'Engineering'];
const roles = ['staff', 'admin'];
const categories = ['Transportation', 'Meals', 'Office Supplies', 'Training', 'Equipment', 'Accommodation'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const statuses = ['pending', 'approved', 'rejected', 'in-progress', 'completed'];
const eventTypes = ['meeting', 'training', 'holiday', 'social', 'conference', 'workshop'];
const assetTypes = ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Desk', 'Chair', 'Vehicle'];
const assetStatuses = ['available', 'assigned', 'maintenance', 'retired'];
const trainingTypes = ['onboarding', 'skill-development', 'leadership', 'safety', 'compliance'];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

async function seedData() {
  try {
    console.log('🚀 Starting seed script...');
    await connectDB();

    // Find organizations
    const louiseInternational = await Organization.findOne({ name: 'Louise International' });
    const harryP = await Organization.findOne({ name: 'Hary P' });
    const gateInt = await Organization.findOne({ name: 'Gate Int.' });

    if (!louiseInternational || !harryP || !gateInt) {
      console.log('❌ Organizations not found. Please ensure organizations exist in the database.');
      process.exit(1);
    }

    const organizations = [
      { org: louiseInternational, staffCount: 100 },
      { org: harryP, staffCount: 150 },
      { org: gateInt, staffCount: 75 }
    ];

    // Clear existing data for these organizations before seeding
    console.log('🧹 Clearing existing data for seed organizations...');
    for (const { org } of organizations) {
      await User.deleteMany({ organization: org._id });
      await Attendance.deleteMany({ organization: org._id });
      await LeaveRequest.deleteMany({ organization: org._id });
      await LeaveType.deleteMany({ organization: org._id });
      await Payroll.deleteMany({ organization: org._id });
      await ExpenseClaim.deleteMany({ organization: org._id });
      await HelpdeskTicket.deleteMany({ organization: org._id });
      await Event.deleteMany({ organization: org._id });
      await InventoryItem.deleteMany({ organization: org._id });
      await TrainingRequest.deleteMany({ organization: org._id });
      await PerformanceEvaluation.deleteMany({ organization: org._id });
      await StaffBankDetails.deleteMany({ organization: org._id });
      await HelpdeskCategory.deleteMany({ organization: org._id });
    }
    console.log('✅ Cleared existing data\n');

    console.log('🚀 Starting seed data generation...\n');

    for (const { org, staffCount } of organizations) {
      console.log(`\n📊 Seeding data for ${org.name} (${staffCount} staff)...`);

      // Create users
      const users = [];
      const usedEmails = new Set();
      
      for (let i = 0; i < staffCount; i++) {
        let firstName = randomElement(firstNames);
        let lastName = randomElement(lastNames);
        let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${org.name.toLowerCase().replace(/\s+/g, '')}.com`;
        
        // Ensure unique email
        let emailSuffix = 1;
        while (usedEmails.has(email)) {
          email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${emailSuffix}@${org.name.toLowerCase().replace(/\s+/g, '')}.com`;
          emailSuffix++;
        }
        usedEmails.add(email);
        
        const user = new User({
          fullName: `${firstName} ${lastName}`,
          email,
          password: '$2b$10$rOzJqYFkQXzKJX8XyKqHPeLt1t7X8vH4F9YvXkQpZG6vM8Vw5Jf5C', // password: "password123"
          department: randomElement(departments),
          role: i === 0 ? 'admin' : randomElement(roles),
          organization: org._id,
          isActive: true,
          phone: `+1${randomNumber(2000000000, 9999999999)}`,
          nationalId: randomNumber(100000000, 999999999).toString()
        });
        
        await user.save();
        users.push(user);
        
        if ((i + 1) % 20 === 0) {
          console.log(`  ✓ Created ${i + 1}/${staffCount} users`);
        }
      }
      console.log(`  ✅ Created ${users.length} users`);

      // Get admin user for creating admin-related data
      const adminUser = users.find(u => u.role === 'admin') || users[0];

      // Create bank details for users
      console.log('  Creating bank details...');
      for (const user of users) {
        const bankDetails = new StaffBankDetails({
          organization_id: org._id,
          staff_id: user._id,
          account_holder_name: user.fullName,
          bank_name: randomElement(['Qatar National Bank', 'Qatar Islamic Bank', 'Commercial Bank', 'Doha Bank']),
          IBAN: `QA${randomNumber(100000000000000000000, 999999999999999999999)}`,
          account_number: randomNumber(1000000, 9999999).toString(),
          currency: 'QAR',
          status: 'active'
        });
        await bankDetails.save();
      }
      console.log('  ✅ Created bank details');

      // Create attendance records (last 90 days)
      console.log('  Creating attendance records...');
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      for (const user of users) {
        for (let day = 0; day < 90; day++) {
          const date = new Date(ninetyDaysAgo.getTime() + day * 24 * 60 * 60 * 1000);
          // Skip weekends (optional)
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          const attendance = new Attendance({
            user: user._id,
            organization: org._id,
            date: date,
            status: Math.random() > 0.1 ? 'present' : 'absent',
            checkIn: randomDate(new Date(date.setHours(8, 0, 0)), new Date(date.setHours(9, 30, 0))),
            checkOut: randomDate(new Date(date.setHours(17, 0, 0)), new Date(date.setHours(18, 30, 0)))
          });
          await attendance.save();
        }
      }
      console.log('  ✅ Created attendance records');

      // Create leave types first
      console.log('  Creating leave types...');
      const leaveTypeNames = ['Annual Leave', 'Sick Leave', 'Personal Leave', 'Emergency Leave'];
      const leaveTypeIds = [];
      
      for (const name of leaveTypeNames) {
        const leaveType = new LeaveType({
          name,
          organization: org._id,
          allocation: randomNumber(5, 15),
          description: `${name} for ${org.name}`,
          isActive: true,
          color: randomElement(['#3B82F6', '#10B981', '#F59E0B', '#EF4444']),
          icon: randomElement(['calendar', 'heart', 'medical', 'clock']),
          createdBy: adminUser._id
        });
        await leaveType.save();
        leaveTypeIds.push(leaveType._id);
      }
      console.log('  ✅ Created leave types');

      // Create leave requests
      console.log('  Creating leave requests...');
      for (let i = 0; i < Math.floor(staffCount * 0.3); i++) {
        const user = randomElement(users);
        const startDate = randomDate(new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), now);
        const endDate = new Date(startDate.getTime() + randomNumber(1, 10) * 24 * 60 * 60 * 1000);
        const totalDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
        
        const leaveRequest = new LeaveRequest({
          user: user._id,
          organization: org._id,
          leaveType: randomElement(leaveTypeIds),
          startDate,
          endDate,
          reason: `Leave request for ${user.fullName}`,
          status: randomElement(['Pending', 'Approved', 'Rejected']),
          totalDays
        });
        await leaveRequest.save();
      }
      console.log('  ✅ Created leave requests');

      // Create payroll records (last 3 months)
      console.log('  Creating payroll records...');
      for (let month = 0; month < 3; month++) {
        const payPeriod = new Date(now.getFullYear(), now.getMonth() - month, 1);
        const payPeriodStr = `${payPeriod.getFullYear()}-${String(payPeriod.getMonth() + 1).padStart(2, '0')}`;
        
        for (const user of users) {
          const grossSalary = randomNumber(3000, 15000);
          const deductions = randomNumber(300, 1000);
          const netSalary = grossSalary - deductions;
          
          const payroll = new Payroll({
            staff: user._id,
            organization: org._id,
            salaryStructure: {
              basicSalary: grossSalary * 0.6,
              allowances: grossSalary * 0.3,
              deductions: grossSalary * 0.1
            },
            payPeriod: payPeriodStr,
            totalWorkdays: randomNumber(20, 26),
            absences: randomNumber(0, 3),
            overtime: randomNumber(0, 20),
            deductions,
            bonuses: randomNumber(0, 500),
            grossSalary,
            netSalary,
            paymentStatus: randomElement(['Paid', 'Pending']),
            paymentMethod: 'Bank Transfer'
          });
          await payroll.save();
        }
      }
      console.log('  ✅ Created payroll records');

      // Create expense claims
      console.log('  Creating expense claims...');
      for (let i = 0; i < Math.floor(staffCount * 0.4); i++) {
        const user = randomElement(users);
        const expenseDate = randomDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now);
        const category = randomElement(categories);
        const amount = randomNumber(50, 500);
        
        const expenseClaim = new ExpenseClaim({
          staffId: user._id,
          organization: org._id,
          title: `Expense claim for ${category}`,
          expenseDate,
          category,
          itemizedExpenses: [
            {
              description: `Item 1 for ${category}`,
              amount: amount * 0.6,
              currency: 'QAR',
              notes: 'Details'
            },
            {
              description: `Item 2 for ${category}`,
              amount: amount * 0.4,
              currency: 'QAR',
              notes: 'Details'
            }
          ],
          totalAmount: amount,
          justification: `Expense justification for ${user.fullName}`,
          declaration: true,
          status: randomElement(['Draft', 'Pending', 'Approved', 'Rejected'])
        });
        await expenseClaim.save();
      }
      console.log('  ✅ Created expense claims');

      // Create helpdesk categories first
      console.log('  Creating helpdesk categories...');
      const categoryNames = ['Technical Support', 'General Inquiry', 'Account Issue', 'Facilities'];
      const categoryIds = [];
      
      for (const name of categoryNames) {
        const category = new HelpdeskCategory({
          name,
          organization: org._id,
          description: `${name} for ${org.name}`,
          isActive: true,
          priorityRules: {
            urgent: { responseTime: 2, description: 'Urgent - respond within 2 hours' },
            high: { responseTime: 8, description: 'High priority - respond within 8 hours' },
            medium: { responseTime: 24, description: 'Normal priority - respond within 24 hours' },
            low: { responseTime: 72, description: 'Standard priority - respond within 72 hours' }
          },
          assignedRoles: ['admin', 'it-team'],
          createdBy: adminUser._id
        });
        await category.save();
        categoryIds.push(category._id);
      }
      console.log('  ✅ Created helpdesk categories');

      // Create helpdesk tickets
      console.log('  Creating helpdesk tickets...');
      for (let i = 0; i < Math.floor(staffCount * 0.2); i++) {
        const user = randomElement(users);
        const ticketNumber = `HD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        const status = randomElement(['open', 'in_progress', 'on_hold', 'resolved', 'closed']);
        
        const ticketData = {
          ticketNumber,
          title: `Support Request ${i + 1}`,
          description: `Helpdesk ticket description for ${user.fullName}`,
          organization: org._id,
          category: randomElement(categoryIds),
          priority: randomElement(['low', 'medium', 'high', 'urgent']),
          status,
          requester: user._id,
          createdBy: user._id
        };
        
        // Add satisfaction rating for closed/resolved tickets
        if (status === 'resolved' || status === 'closed') {
          ticketData.satisfaction = {
            rating: randomNumber(3, 5),
            feedback: 'Ticket resolved successfully',
            submittedAt: new Date()
          };
          ticketData.resolvedAt = randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now);
        }
        
        const ticket = new HelpdeskTicket(ticketData);
        await ticket.save();
      }
      console.log('  ✅ Created helpdesk tickets');

      // Create events
      console.log('  Creating events...');
      for (let i = 0; i < randomNumber(10, 20); i++) {
        const user = randomElement(users);
        const eventDate = randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000));
        const endDate = new Date(eventDate.getTime() + randomNumber(1, 3) * 24 * 60 * 60 * 1000);
        
        const event = new Event({
          title: `${randomElement(eventTypes)} Event ${i + 1}`,
          description: `Event description for ${org.name}`,
          type: randomElement(['internal', 'external']),
          organization: org._id,
          leadUserId: user._id,
          startsAt: eventDate,
          endsAt: endDate,
          locationText: `${org.name} Building`,
          expectedAttendees: randomNumber(10, 100),
          attendanceMode: randomElement(['in-person', 'virtual', 'hybrid']),
          status: randomElement(['draft', 'pending_approval', 'scheduled', 'completed']),
          createdBy: user._id
        });
        await event.save();
      }
      console.log('  ✅ Created events');

      // Create inventory items
      console.log('  Creating inventory items...');
      const orgPrefix = org.name.substring(0, 3).toUpperCase();
      for (let i = 0; i < randomNumber(30, 50); i++) {
        const inventoryItem = new InventoryItem({
          itemCode: `${orgPrefix}${String(i + 1).padStart(4, '0')}`,
          serialNumber: `SN${randomNumber(100000, 999999)}`,
          name: `${randomElement(assetTypes)} ${i + 1}`,
          category: randomElement(assetTypes),
          description: `Inventory item for ${org.name}`,
          quantity: randomNumber(1, 10),
          minimumThreshold: 2,
          maximumThreshold: 50,
          unitPrice: randomNumber(500, 5000),
          supplier: `Supplier ${randomNumber(1, 10)}`,
          organization: org._id
        });
        await inventoryItem.save();
      }
      console.log('  ✅ Created inventory items');

      // Create training requests
      console.log('  Creating training requests...');
      for (let i = 0; i < Math.floor(staffCount * 0.3); i++) {
        const user = randomElement(users);
        const admin = randomElement(users.filter(u => u.role === 'admin'));
        const requestedDate = randomDate(new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), now);
        
        const training = new TrainingRequest({
          staffId: user._id,
          organization: org._id,
          adminId: admin._id,
          trainingTitle: `${randomElement(trainingTypes)} Training`,
          hostedBy: `Training Provider ${randomNumber(1, 5)}`,
          location: randomElement(['Qatar', 'UAE', 'Online', 'Regional Office']),
          numberOfDays: randomNumber(1, 5),
          costBreakdown: {
            registrationFee: randomNumber(100, 500),
            travelCost: randomNumber(200, 1000),
            accommodationCost: randomNumber(300, 800),
            mealCost: randomNumber(50, 200),
            otherCost: randomNumber(50, 300)
          },
          justification: `Training justification for ${user.fullName}`,
          expectedOutcomes: 'Improved skills and knowledge',
          benefitToOrg: 'Enhanced productivity and efficiency',
          coverRequirements: 'Covered by department budget',
          status: randomElement(['Draft', 'Pending', 'Approved', 'Rejected']),
          requestedDate,
          currency: 'QAR'
        });
        await training.save();
      }
      console.log('  ✅ Created training requests');

      // Create performance evaluations
      console.log('  Creating performance evaluations...');
      for (let i = 0; i < Math.floor(staffCount * 0.6); i++) {
        const user = randomElement(users);
        const evaluator = randomElement(users.filter(u => u.role === 'admin'));
        const evalDate = randomDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now);
        
        const evaluation = new PerformanceEvaluation({
          staff: user._id,
          organization: org._id,
          evaluator: evaluator._id,
          evaluationDate: evalDate,
          status: randomElement(['pending', 'in_progress', 'completed']),
          goals: [
            {
              specific: 'Goal 1 specific',
              measurable: 'Goal 1 measurable',
              achievable: 'Goal 1 achievable',
              relevant: 'Goal 1 relevant',
              timeBound: 'Goal 1 time bound',
              status: randomElement(['pending', 'in progress', 'achieved', 'not achieved'])
            },
            {
              specific: 'Goal 2 specific',
              measurable: 'Goal 2 measurable',
              achievable: 'Goal 2 achievable',
              relevant: 'Goal 2 relevant',
              timeBound: 'Goal 2 time bound',
              status: randomElement(['pending', 'in progress', 'achieved', 'not achieved'])
            }
          ],
          feedback: `Performance evaluation for ${user.fullName}`
        });
        await evaluation.save();
      }
      console.log('  ✅ Created performance evaluations');

      // Skip onboarding tasks due to complex requirements
      console.log('  ⏭️  Skipping onboarding tasks (requires OnboardingPipeline)');

      console.log(`\n✅ Completed seeding data for ${org.name}\n`);
    }

    console.log('🎉 All seed data generation completed successfully!');
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
