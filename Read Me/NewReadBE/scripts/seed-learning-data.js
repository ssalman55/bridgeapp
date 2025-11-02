console.log('📝 Learning Data Seeding Script Starting...');

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });
console.log('🔧 Environment variables loaded');

const User = require('../src/models/User');
const TrainingRequest = require('../src/models/TrainingRequest');
const PerformanceEvaluation = require('../src/models/PerformanceEvaluation');
const Organization = require('../src/models/Organization');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample data for training requests
const trainingData = [
  {
    trainingTitle: "Advanced Project Management Certification",
    hostedBy: "Project Management Institute (PMI)",
    location: "Dubai, UAE",
    numberOfDays: 5,
    costBreakdown: {
      registrationFee: 2500,
      travelCost: 800,
      accommodationCost: 1200,
      mealCost: 400,
      otherCost: 200,
      otherCostDescription: "Course materials and certification fees"
    },
    justification: "This certification will enhance my project management skills and enable me to lead complex projects more effectively. It aligns with our department's goal to improve project delivery timelines.",
    expectedOutcomes: "Gain PMP certification, learn advanced project management methodologies, improve team leadership skills, and enhance risk management capabilities.",
    benefitToOrg: "Improved project success rates, better resource allocation, enhanced team productivity, and reduced project delays. This will directly impact our quarterly project delivery targets.",
    coverRequirements: "Sarah Johnson will cover my responsibilities during the training period. She has been briefed on all ongoing projects and has access to all necessary systems.",
    additionalNotes: "This training is time-sensitive as the certification exam is scheduled for next month. Early approval would be greatly appreciated.",
    currency: "QAR"
  },
  {
    trainingTitle: "Digital Marketing Strategy Workshop",
    hostedBy: "Google Digital Academy",
    location: "Online (Virtual)",
    numberOfDays: 3,
    costBreakdown: {
      registrationFee: 1500,
      travelCost: 0,
      accommodationCost: 0,
      mealCost: 0,
      otherCost: 100,
      otherCostDescription: "Digital marketing toolkit and resources"
    },
    justification: "Our marketing department needs to stay updated with the latest digital marketing trends and tools. This workshop will help us improve our online presence and customer engagement.",
    expectedOutcomes: "Learn advanced digital marketing strategies, understand Google Analytics and Ads, improve social media marketing skills, and develop data-driven marketing approaches.",
    benefitToOrg: "Enhanced online marketing campaigns, improved ROI on marketing spend, better customer acquisition, and increased brand visibility in digital channels.",
    coverRequirements: "The marketing team will redistribute tasks among existing team members during the training period.",
    additionalNotes: "This is a virtual training, so no travel or accommodation costs are involved.",
    currency: "QAR"
  },
  {
    trainingTitle: "Leadership and Team Management",
    hostedBy: "Harvard Business School Online",
    location: "Online (Virtual)",
    numberOfDays: 8,
    costBreakdown: {
      registrationFee: 3200,
      travelCost: 0,
      accommodationCost: 0,
      mealCost: 0,
      otherCost: 300,
      otherCostDescription: "Course materials and case studies"
    },
    justification: "As a team lead, I need to enhance my leadership skills to better manage my team and drive performance improvements. This course will provide practical leadership frameworks.",
    expectedOutcomes: "Develop effective leadership styles, improve team communication, learn conflict resolution techniques, and enhance decision-making capabilities.",
    benefitToOrg: "Improved team productivity, better employee retention, enhanced team collaboration, and stronger leadership pipeline for future growth.",
    coverRequirements: "My deputy team lead will handle day-to-day operations during the training period.",
    additionalNotes: "This course is self-paced and can be completed over 8 weeks, allowing flexibility with work schedule.",
    currency: "QAR"
  },
  {
    trainingTitle: "Data Analytics and Business Intelligence",
    hostedBy: "Microsoft Learning Partners",
    location: "Doha, Qatar",
    numberOfDays: 4,
    costBreakdown: {
      registrationFee: 2800,
      travelCost: 200,
      accommodationCost: 0,
      mealCost: 150,
      otherCost: 250,
      otherCostDescription: "Software licenses and practice datasets"
    },
    justification: "Our department is moving towards data-driven decision making. This training will equip me with essential data analytics skills to support this initiative.",
    expectedOutcomes: "Master Power BI and Excel advanced analytics, learn data visualization techniques, understand statistical analysis, and develop business intelligence dashboards.",
    benefitToOrg: "Improved data-driven decision making, better business insights, enhanced reporting capabilities, and more accurate forecasting.",
    coverRequirements: "Colleagues in the analytics team will cover my responsibilities during the training.",
    additionalNotes: "This training includes hands-on practice with real business scenarios.",
    currency: "QAR"
  },
  {
    trainingTitle: "Cybersecurity Fundamentals",
    hostedBy: "Cisco Networking Academy",
    location: "Kuwait City, Kuwait",
    numberOfDays: 6,
    costBreakdown: {
      registrationFee: 2200,
      travelCost: 600,
      accommodationCost: 900,
      mealCost: 300,
      otherCost: 150,
      otherCostDescription: "Lab equipment and simulation software"
    },
    justification: "With increasing cyber threats, our IT team needs to strengthen our security posture. This training will provide essential cybersecurity knowledge and skills.",
    expectedOutcomes: "Understand cybersecurity threats and vulnerabilities, learn security best practices, develop incident response skills, and implement security controls.",
    benefitToOrg: "Enhanced security posture, reduced risk of cyber attacks, improved incident response capabilities, and better compliance with security standards.",
    coverRequirements: "The IT team will redistribute tasks to ensure continuous coverage during the training period.",
    additionalNotes: "This training includes practical labs and real-world scenarios.",
    currency: "QAR"
  },
  {
    trainingTitle: "Customer Service Excellence",
    hostedBy: "International Customer Service Association",
    location: "Online (Virtual)",
    numberOfDays: 2,
    costBreakdown: {
      registrationFee: 800,
      travelCost: 0,
      accommodationCost: 0,
      mealCost: 0,
      otherCost: 50,
      otherCostDescription: "Customer service toolkit and templates"
    },
    justification: "Our customer service team needs to enhance their skills to improve customer satisfaction scores and reduce complaint resolution time.",
    expectedOutcomes: "Learn advanced customer service techniques, improve communication skills, develop problem-solving approaches, and enhance customer relationship management.",
    benefitToOrg: "Higher customer satisfaction scores, reduced complaint resolution time, improved customer retention, and enhanced brand reputation.",
    coverRequirements: "Team members will cover shifts during the training period.",
    additionalNotes: "This is a weekend training to minimize impact on regular operations.",
    currency: "QAR"
  },
  {
    trainingTitle: "Financial Analysis and Reporting",
    hostedBy: "CFA Institute",
    location: "Riyadh, Saudi Arabia",
    numberOfDays: 5,
    costBreakdown: {
      registrationFee: 3000,
      travelCost: 1000,
      accommodationCost: 1500,
      mealCost: 500,
      otherCost: 200,
      otherCostDescription: "Financial modeling software and case studies"
    },
    justification: "As a financial analyst, I need to enhance my skills in financial modeling and analysis to provide better insights for business decisions.",
    expectedOutcomes: "Master advanced financial modeling, improve financial analysis techniques, learn valuation methods, and enhance reporting capabilities.",
    benefitToOrg: "More accurate financial forecasts, better investment analysis, improved financial reporting, and enhanced decision-making support.",
    coverRequirements: "Senior financial analyst will cover my responsibilities during the training period.",
    additionalNotes: "This training includes certification that will enhance our team's credibility.",
    currency: "QAR"
  },
  {
    trainingTitle: "Agile Project Management",
    hostedBy: "Scrum Alliance",
    location: "Online (Virtual)",
    numberOfDays: 3,
    costBreakdown: {
      registrationFee: 1200,
      travelCost: 0,
      accommodationCost: 0,
      mealCost: 0,
      otherCost: 100,
      otherCostDescription: "Agile tools and templates"
    },
    justification: "Our development team is transitioning to Agile methodology. This training will help me become a certified Scrum Master to lead this transition effectively.",
    expectedOutcomes: "Become a certified Scrum Master, learn Agile principles and practices, understand sprint planning and execution, and develop team facilitation skills.",
    benefitToOrg: "Successful Agile transformation, improved development efficiency, better team collaboration, and faster product delivery cycles.",
    coverRequirements: "Project coordinator will handle project management tasks during the training period.",
    additionalNotes: "This certification will help establish our Agile practices across the organization.",
    currency: "QAR"
  }
];

// Sample data for performance evaluations
const performanceData = [
  {
    goals: [
      {
        specific: "Complete the customer service training program and achieve 95% customer satisfaction rating",
        measurable: "Track customer satisfaction scores monthly and maintain above 95%",
        achievable: "Attend training sessions and implement learned techniques in daily interactions",
        relevant: "Aligns with company goal of improving customer experience and retention",
        timeBound: "Complete training by end of Q2 and maintain satisfaction scores throughout Q3",
        status: "in progress"
      },
      {
        specific: "Reduce average call handling time by 20% while maintaining service quality",
        measurable: "Monitor call duration metrics and quality scores weekly",
        achievable: "Implement efficient call handling techniques and use knowledge base effectively",
        relevant: "Improves operational efficiency and customer wait times",
        timeBound: "Achieve target by end of Q3 with monthly progress reviews",
        status: "pending"
      }
    ],
    initialFeedback: "Sarah has shown excellent customer service skills and is always willing to help colleagues. She demonstrates strong communication abilities and maintains a positive attitude even during challenging situations.",
    midyearFeedback: "Great progress on customer satisfaction goals. The training program has been beneficial and Sarah has implemented several new techniques effectively.",
    yearendFeedback: "Outstanding performance this year. Sarah exceeded customer satisfaction targets and significantly improved call handling efficiency. She has become a role model for the team.",
    feedback: "Sarah has consistently exceeded expectations and demonstrated strong leadership potential. Her dedication to customer service excellence has positively impacted the entire team.",
    staffComments: [
      {
        comment: "I'm grateful for the training opportunities provided this year. The customer service program has helped me develop new skills and confidence in handling complex customer issues.",
        date: new Date('2024-06-15')
      },
      {
        comment: "I'm proud of achieving the customer satisfaction targets and look forward to taking on more challenging projects next year.",
        date: new Date('2024-12-01')
      }
    ],
    status: "completed"
  },
  {
    goals: [
      {
        specific: "Lead the implementation of new inventory management system",
        measurable: "Complete system setup and train all users within 3 months",
        achievable: "Work with IT team and vendor to ensure smooth implementation",
        relevant: "Critical for improving inventory accuracy and reducing costs",
        timeBound: "Complete implementation by end of Q2, user training by end of Q3",
        status: "achieved"
      },
      {
        specific: "Reduce inventory discrepancies by 50% through improved processes",
        measurable: "Monthly inventory audits showing reduced variance",
        achievable: "Implement new tracking procedures and regular audits",
        relevant: "Directly impacts cost control and operational efficiency",
        timeBound: "Achieve target by end of Q4 with quarterly progress reviews",
        status: "in progress"
      }
    ],
    initialFeedback: "Ahmed has strong technical skills and good understanding of inventory processes. He shows initiative in identifying improvement opportunities.",
    midyearFeedback: "Excellent work on the inventory system implementation. Ahmed has demonstrated strong project management skills and effective communication with stakeholders.",
    yearendFeedback: "Outstanding performance on both goals. The inventory system is working well and discrepancies have been significantly reduced. Ahmed has shown excellent leadership skills.",
    feedback: "Ahmed has exceeded expectations and demonstrated strong technical and leadership capabilities. He has become a key contributor to process improvements.",
    staffComments: [
      {
        comment: "The inventory system implementation was challenging but rewarding. I learned a lot about project management and stakeholder communication.",
        date: new Date('2024-07-20')
      }
    ],
    status: "completed"
  },
  {
    goals: [
      {
        specific: "Complete advanced Excel and data analysis training",
        measurable: "Pass certification exam with 90% or higher score",
        achievable: "Attend training sessions and practice with real business data",
        relevant: "Essential for improving reporting accuracy and efficiency",
        timeBound: "Complete training and certification by end of Q2",
        status: "achieved"
      },
      {
        specific: "Develop automated reporting dashboard for monthly financial reports",
        measurable: "Create dashboard that reduces report generation time by 75%",
        achievable: "Use Excel advanced features and Power BI for automation",
        relevant: "Improves efficiency and accuracy of financial reporting",
        timeBound: "Complete dashboard development by end of Q3",
        status: "in progress"
      }
    ],
    initialFeedback: "Fatima shows strong analytical skills and attention to detail. She is eager to learn new technologies and improve processes.",
    midyearFeedback: "Excellent progress on the Excel training. Fatima has already started applying new skills to improve our reporting processes.",
    yearendFeedback: "Outstanding work on both goals. The automated dashboard has significantly improved our reporting efficiency and accuracy.",
    feedback: "Fatima has demonstrated exceptional analytical skills and initiative in process improvement. She has become a valuable asset to the finance team.",
    staffComments: [
      {
        comment: "The Excel training was very beneficial and I'm excited about the new reporting capabilities I've developed.",
        date: new Date('2024-05-30')
      }
    ],
    status: "completed"
  },
  {
    goals: [
      {
        specific: "Improve team productivity by implementing new project management tools",
        measurable: "Increase project completion rate by 25% and reduce delays by 30%",
        achievable: "Research and implement appropriate project management software",
        relevant: "Critical for meeting project deadlines and improving team efficiency",
        timeBound: "Complete implementation by end of Q2, see results by end of Q3",
        status: "in progress"
      },
      {
        specific: "Develop leadership skills through management training program",
        measurable: "Complete leadership assessment and implement feedback",
        achievable: "Attend training sessions and apply learned techniques",
        relevant: "Prepares for future management responsibilities and team growth",
        timeBound: "Complete training by end of Q3, implement changes throughout Q4",
        status: "pending"
      }
    ],
    initialFeedback: "Mohammed shows good technical skills and team collaboration abilities. He has potential for leadership roles with proper development.",
    midyearFeedback: "Good progress on the project management tools implementation. Mohammed has shown initiative in researching and testing different solutions.",
    yearendFeedback: "Strong performance on productivity improvements. The new tools have helped the team work more efficiently. Mohammed has shown good leadership potential.",
    feedback: "Mohammed has demonstrated strong technical skills and initiative in process improvement. He is ready for more leadership responsibilities.",
    staffComments: [
      {
        comment: "I'm excited about the new project management tools and the positive impact they've had on our team's productivity.",
        date: new Date('2024-08-15')
      }
    ],
    status: "in_progress"
  },
  {
    goals: [
      {
        specific: "Enhance customer support skills through advanced training",
        measurable: "Achieve 98% customer satisfaction rating and reduce resolution time by 40%",
        achievable: "Attend training sessions and implement best practices",
        relevant: "Improves customer experience and operational efficiency",
        timeBound: "Complete training by end of Q2, achieve targets by end of Q3",
        status: "in progress"
      },
      {
        specific: "Mentor new team members and help with their onboarding",
        measurable: "Successfully onboard 3 new team members with positive feedback",
        achievable: "Use experience and knowledge to guide new employees",
        relevant: "Supports team growth and knowledge sharing",
        timeBound: "Complete mentoring by end of Q4",
        status: "pending"
      }
    ],
    initialFeedback: "Aisha has excellent customer service skills and is always willing to help colleagues. She shows strong potential for mentoring roles.",
    midyearFeedback: "Great progress on customer satisfaction goals. Aisha has implemented new techniques effectively and shows natural mentoring abilities.",
    yearendFeedback: "Outstanding performance on customer service metrics. Aisha has become a go-to person for complex customer issues and team guidance.",
    feedback: "Aisha has exceeded expectations and demonstrated strong leadership and mentoring capabilities. She has become an invaluable team member.",
    staffComments: [
      {
        comment: "I'm proud of the improvements in customer satisfaction and enjoy helping new team members learn and grow.",
        date: new Date('2024-09-10')
      }
    ],
    status: "completed"
  }
];

// Sample statuses for training requests
const trainingStatuses = ['Draft', 'Pending', 'Approved', 'Rejected'];
const performanceStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

// Sample currencies
const currencies = ['QAR', 'USD', 'EUR'];

// Function to get random item from array
const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Function to get random date within range
const getRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Function to seed training requests
const seedTrainingRequests = async () => {
  try {
    console.log('🌱 Seeding Training Requests...');
    
    // Get all active staff members
    const staff = await User.find({ 
      status: 'active',
      role: { $in: ['staff', 'manager', 'hr'] }
    }).limit(20);
    
    if (staff.length === 0) {
      console.log('❌ No active staff found. Please ensure staff data exists.');
      return;
    }

    // Get organizations
    const organizations = await Organization.find();
    if (organizations.length === 0) {
      console.log('❌ No organizations found. Please ensure organization data exists.');
      return;
    }

    const trainingRequests = [];
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));

    // Create training requests for each staff member
    for (let i = 0; i < staff.length; i++) {
      const staffMember = staff[i];
      const organization = getRandomItem(organizations);
      
      // Create 1-3 training requests per staff member
      const numRequests = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < numRequests; j++) {
        const trainingTemplate = getRandomItem(trainingData);
        const status = getRandomItem(trainingStatuses);
        const requestedDate = getRandomDate(sixMonthsAgo, now);
        
        // Add some variation to the training data
        const trainingRequest = {
          staffId: staffMember._id,
          organization: organization._id,
          trainingTitle: trainingTemplate.trainingTitle,
          hostedBy: trainingTemplate.hostedBy,
          location: trainingTemplate.location,
          numberOfDays: trainingTemplate.numberOfDays,
          costBreakdown: {
            ...trainingTemplate.costBreakdown,
            registrationFee: Math.floor(trainingTemplate.costBreakdown.registrationFee * (0.8 + Math.random() * 0.4)),
            travelCost: Math.floor(trainingTemplate.costBreakdown.travelCost * (0.8 + Math.random() * 0.4)),
            accommodationCost: Math.floor(trainingTemplate.costBreakdown.accommodationCost * (0.8 + Math.random() * 0.4)),
            mealCost: Math.floor(trainingTemplate.costBreakdown.mealCost * (0.8 + Math.random() * 0.4)),
            otherCost: Math.floor(trainingTemplate.costBreakdown.otherCost * (0.8 + Math.random() * 0.4))
          },
          justification: trainingTemplate.justification,
          expectedOutcomes: trainingTemplate.expectedOutcomes,
          benefitToOrg: trainingTemplate.benefitToOrg,
          coverRequirements: trainingTemplate.coverRequirements,
          additionalNotes: trainingTemplate.additionalNotes,
          status: status,
          requestedDate: requestedDate,
          currency: getRandomItem(currencies)
        };

        // Add admin details for approved/rejected requests
        if (status === 'Approved' || status === 'Rejected') {
          const admin = await User.findOne({ 
            organization: organization._id,
            role: { $in: ['admin', 'hr'] }
          });
          
          if (admin) {
            trainingRequest.adminId = admin._id;
            trainingRequest.approvedRejectedBy = admin._id;
            trainingRequest.decisionDate = getRandomDate(requestedDate, now);
            trainingRequest.adminComment = status === 'Approved' 
              ? 'Training request approved. This aligns with our professional development goals.'
              : 'Training request rejected due to budget constraints. Please consider alternative options.';
          }
        }

        trainingRequests.push(trainingRequest);
      }
    }

    // Insert training requests
    await TrainingRequest.insertMany(trainingRequests);
    console.log(`✅ Created ${trainingRequests.length} training requests`);
    
  } catch (error) {
    console.error('❌ Error seeding training requests:', error);
  }
};

// Function to seed performance evaluations
const seedPerformanceEvaluations = async () => {
  try {
    console.log('🌱 Seeding Performance Evaluations...');
    
    // Get all active staff members
    const staff = await User.find({ 
      status: 'active',
      role: { $in: ['staff', 'manager'] }
    }).limit(15);
    
    if (staff.length === 0) {
      console.log('❌ No active staff found. Please ensure staff data exists.');
      return;
    }

    // Get organizations
    const organizations = await Organization.find();
    if (organizations.length === 0) {
      console.log('❌ No organizations found. Please ensure organization data exists.');
      return;
    }

    const performanceEvaluations = [];
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));

    // Create performance evaluations for each staff member
    for (let i = 0; i < staff.length; i++) {
      const staffMember = staff[i];
      const organization = getRandomItem(organizations);
      
      // Find an evaluator (admin or manager)
      const evaluator = await User.findOne({ 
        organization: organization._id,
        role: { $in: ['admin', 'manager', 'hr'] },
        _id: { $ne: staffMember._id }
      });
      
      if (!evaluator) continue;

      const performanceTemplate = getRandomItem(performanceData);
      const status = getRandomItem(performanceStatuses);
      const evaluationDate = getRandomDate(oneYearAgo, now);
      
      // Add some variation to the performance data
      const performanceEvaluation = {
        staff: staffMember._id,
        evaluator: evaluator._id,
        organization: organization._id,
        goals: performanceTemplate.goals.map(goal => ({
          ...goal,
          specific: goal.specific.replace(/Sarah|Ahmed|Fatima|Mohammed|Aisha/g, staffMember.fullName.split(' ')[0]),
          measurable: goal.measurable,
          achievable: goal.achievable,
          relevant: goal.relevant,
          timeBound: goal.timeBound,
          status: goal.status
        })),
        initialFeedback: performanceTemplate.initialFeedback.replace(/Sarah|Ahmed|Fatima|Mohammed|Aisha/g, staffMember.fullName.split(' ')[0]),
        midyearFeedback: performanceTemplate.midyearFeedback?.replace(/Sarah|Ahmed|Fatima|Mohammed|Aisha/g, staffMember.fullName.split(' ')[0]),
        yearendFeedback: performanceTemplate.yearendFeedback?.replace(/Sarah|Ahmed|Fatima|Mohammed|Aisha/g, staffMember.fullName.split(' ')[0]),
        feedback: performanceTemplate.feedback.replace(/Sarah|Ahmed|Fatima|Mohammed|Aisha/g, staffMember.fullName.split(' ')[0]),
        staffComments: performanceTemplate.staffComments.map(comment => ({
          ...comment,
          comment: comment.comment.replace(/Sarah|Ahmed|Fatima|Mohammed|Aisha/g, staffMember.fullName.split(' ')[0])
        })),
        evaluationDate: evaluationDate,
        status: status
      };

      performanceEvaluations.push(performanceEvaluation);
    }

    // Insert performance evaluations
    await PerformanceEvaluation.insertMany(performanceEvaluations);
    console.log(`✅ Created ${performanceEvaluations.length} performance evaluations`);
    
  } catch (error) {
    console.error('❌ Error seeding performance evaluations:', error);
  }
};

// Main seeding function
const seedLearningData = async () => {
  try {
    console.log('🚀 Starting Learning Data Seeding...');
    console.log('🔍 Checking environment variables...');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    // Connect to database
    await connectDB();
    
    // Clear existing data
    console.log('🧹 Clearing existing learning data...');
    await TrainingRequest.deleteMany({});
    await PerformanceEvaluation.deleteMany({});
    console.log('✅ Existing data cleared');
    
    // Seed data
    await seedTrainingRequests();
    await seedPerformanceEvaluations();
    
    console.log('🎉 Learning data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Training Requests: Seeded with realistic data');
    console.log('- Performance Evaluations: Seeded with comprehensive evaluations');
    console.log('- All data is consistent with existing staff and organizations');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the seeding script
if (require.main === module) {
  seedLearningData();
}

module.exports = { seedLearningData };
