const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const OnboardingTemplate = require('../src/models/OnboardingTemplate');
const OnboardingPipeline = require('../src/models/OnboardingPipeline');
const User = require('../src/models/User');
const Organization = require('../src/models/Organization');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedOnboardingData = async () => {
  try {
    console.log('🌱 Starting onboarding data seeding...');

    // Find the first organization and admin user
    const organization = await Organization.findOne();
    if (!organization) {
      console.log('❌ No organization found. Please create an organization first.');
      return;
    }

    const adminUser = await User.findOne({ 
      organization: organization._id, 
      role: 'admin' 
    });
    
    if (!adminUser) {
      console.log('❌ No admin user found for the organization.');
      return;
    }

    console.log(`📋 Working with organization: ${organization.name}`);
    console.log(`👤 Admin user: ${adminUser.fullName || adminUser.firstName + ' ' + adminUser.lastName || adminUser.email}`);

    // Create sample onboarding templates
    const templates = [
      {
        name: 'Software Developer Onboarding',
        description: 'Comprehensive onboarding process for new software developers',
        organization: organization._id,
        department: 'Engineering',
        role: 'Software Developer',
        location: 'Main Office',
        isActive: true,
        checklistItems: [
          {
            id: 'welcome-email',
            title: 'Send Welcome Email',
            description: 'Send personalized welcome email with first day information',
            taskType: 'generic-hr',
            ownerRole: 'hr',
            relativeDueDate: -7, // 7 days before start
            slaHours: 24,
            isRequired: true,
            dependencies: [],
            order: 1
          },
          {
            id: 'equipment-setup',
            title: 'Setup Development Equipment',
            description: 'Prepare laptop, monitor, and development tools',
            taskType: 'equipment',
            ownerRole: 'it',
            relativeDueDate: -3, // 3 days before start
            slaHours: 48,
            isRequired: true,
            dependencies: [],
            order: 2
          },
          {
            id: 'account-creation',
            title: 'Create User Accounts',
            description: 'Setup email, GitHub, and development environment accounts',
            taskType: 'it-provisioning',
            ownerRole: 'it',
            relativeDueDate: -2, // 2 days before start
            slaHours: 24,
            isRequired: true,
            dependencies: ['equipment-setup'],
            order: 3
          },
          {
            id: 'security-training',
            title: 'Complete Security Awareness Training',
            description: 'Mandatory security and compliance training',
            taskType: 'training',
            ownerRole: 'new-hire',
            relativeDueDate: 3, // 3 days after start
            slaHours: 72,
            isRequired: true,
            dependencies: [],
            order: 4
          },
          {
            id: 'team-introduction',
            title: 'Team Introduction Meeting',
            description: 'Meet with team members and understand project structure',
            taskType: 'orientation',
            ownerRole: 'manager',
            relativeDueDate: 1, // 1 day after start
            slaHours: 8,
            isRequired: true,
            dependencies: [],
            order: 5
          },
          {
            id: 'code-review',
            title: 'First Code Review Session',
            description: 'Review coding standards and development practices',
            taskType: 'manager-task',
            ownerRole: 'manager',
            relativeDueDate: 7, // 1 week after start
            slaHours: 24,
            isRequired: true,
            dependencies: ['team-introduction'],
            order: 6
          },
          {
            id: '30-day-checkin',
            title: '30-Day Check-in Meeting',
            description: 'Performance review and feedback session',
            taskType: 'manager-task',
            ownerRole: 'manager',
            relativeDueDate: 30, // 30 days after start
            slaHours: 48,
            isRequired: true,
            dependencies: [],
            order: 7
          }
        ],
        documentPackages: [
          {
            name: 'Employment Documents',
            documents: [
              {
                name: 'Employment Contract',
                signerRoles: ['new-hire', 'hr'],
                isRequired: true
              },
              {
                name: 'NDA Agreement',
                signerRoles: ['new-hire'],
                isRequired: true
              },
              {
                name: 'Employee Handbook Acknowledgment',
                signerRoles: ['new-hire'],
                isRequired: true
              }
            ]
          }
        ],
        equipmentKits: [
          {
            name: 'Developer Starter Kit',
            items: [
              {
                itemId: 'laptop-dev',
                itemName: 'Development Laptop',
                category: 'laptop',
                isRequired: true
              },
              {
                itemId: 'monitor-external',
                itemName: 'External Monitor',
                category: 'monitor',
                isRequired: true
              },
              {
                itemId: 'keyboard-mechanical',
                itemName: 'Mechanical Keyboard',
                category: 'accessory',
                isRequired: false
              }
            ]
          }
        ],
        defaultAssignees: {
          hr: adminUser._id,
          it: adminUser._id, // In a real scenario, this would be an IT user
          facilities: adminUser._id
        },
        createdBy: adminUser._id
      },
      {
        name: 'Sales Representative Onboarding',
        description: 'Onboarding process for new sales team members',
        organization: organization._id,
        department: 'Sales',
        role: 'Sales Representative',
        location: 'Main Office',
        isActive: true,
        checklistItems: [
          {
            id: 'welcome-sales',
            title: 'Send Welcome Package',
            description: 'Send welcome email with sales materials and territory information',
            taskType: 'generic-hr',
            ownerRole: 'hr',
            relativeDueDate: -5,
            slaHours: 24,
            isRequired: true,
            dependencies: [],
            order: 1
          },
          {
            id: 'crm-setup',
            title: 'Setup CRM Access',
            description: 'Create CRM account and configure territory access',
            taskType: 'it-provisioning',
            ownerRole: 'it',
            relativeDueDate: -2,
            slaHours: 24,
            isRequired: true,
            dependencies: [],
            order: 2
          },
          {
            id: 'sales-training',
            title: 'Sales Process Training',
            description: 'Complete sales methodology and process training',
            taskType: 'training',
            ownerRole: 'new-hire',
            relativeDueDate: 5,
            slaHours: 40,
            isRequired: true,
            dependencies: [],
            order: 3
          },
          {
            id: 'territory-handover',
            title: 'Territory Handover Meeting',
            description: 'Meet with previous rep or manager for territory overview',
            taskType: 'manager-task',
            ownerRole: 'manager',
            relativeDueDate: 1,
            slaHours: 8,
            isRequired: true,
            dependencies: [],
            order: 4
          },
          {
            id: 'first-client-meeting',
            title: 'First Client Meeting',
            description: 'Shadow manager or colleague on first client meeting',
            taskType: 'manager-task',
            ownerRole: 'manager',
            relativeDueDate: 10,
            slaHours: 24,
            isRequired: true,
            dependencies: ['territory-handover'],
            order: 5
          }
        ],
        documentPackages: [
          {
            name: 'Sales Documentation',
            documents: [
              {
                name: 'Employment Contract',
                signerRoles: ['new-hire', 'hr'],
                isRequired: true
              },
              {
                name: 'Commission Agreement',
                signerRoles: ['new-hire', 'hr'],
                isRequired: true
              }
            ]
          }
        ],
        equipmentKits: [
          {
            name: 'Sales Kit',
            items: [
              {
                itemId: 'laptop-sales',
                itemName: 'Sales Laptop',
                category: 'laptop',
                isRequired: true
              },
              {
                itemId: 'phone-mobile',
                itemName: 'Company Mobile Phone',
                category: 'phone',
                isRequired: true
              }
            ]
          }
        ],
        defaultAssignees: {
          hr: adminUser._id,
          it: adminUser._id,
          facilities: adminUser._id
        },
        createdBy: adminUser._id
      }
    ];

    // Insert templates (handle duplicates gracefully)
    console.log('📝 Creating onboarding templates...');
    const createdTemplates = [];
    
    for (const template of templates) {
      try {
        const existingTemplate = await OnboardingTemplate.findOne({
          organization: organization._id,
          name: template.name
        });
        
        if (!existingTemplate) {
          const newTemplate = await OnboardingTemplate.create(template);
          createdTemplates.push(newTemplate);
          console.log(`✅ Created template: ${template.name}`);
        } else {
          createdTemplates.push(existingTemplate);
          console.log(`📋 Using existing template: ${template.name}`);
        }
      } catch (error) {
        console.log(`⚠️  Error with template ${template.name}:`, error.message);
      }
    }
    
    console.log(`✅ Templates ready: ${createdTemplates.length} total`);

    // Create a sample new hire user
    const newHireData = {
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: '$2a$10$dummy.hash.for.demo.purposes.only', // In real scenario, would be properly hashed
      role: 'staff',
      department: 'Engineering',
      organization: organization._id,
      isEmailVerified: false,
      ssoOnly: false
    };

    // Check if user already exists
    let newHire = await User.findOne({ 
      email: newHireData.email, 
      organization: organization._id 
    });
    
    if (!newHire) {
      newHire = await User.create(newHireData);
      console.log(`👤 Created sample new hire: ${newHire.fullName || newHire.firstName + ' ' + newHire.lastName}`);
    } else {
      console.log(`👤 Using existing user: ${newHire.fullName || newHire.firstName + ' ' + newHire.lastName}`);
    }

    // Create a sample onboarding pipeline
    const pipelineData = {
      newHire: newHire._id,
      organization: organization._id,
      template: createdTemplates[0]._id, // Use the first template
      templateSnapshot: createdTemplates[0].toObject(),
      employeeId: 'EMP-2024-001',
      position: 'Software Developer',
      department: 'Engineering',
      location: 'Main Office',
      manager: adminUser._id,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Start in 1 week
      currentStage: 'preboarding',
      priority: 'normal',
      preboardingToken: require('crypto').randomBytes(32).toString('hex'),
      preboardingCompleted: false,
      createdBy: adminUser._id
    };

    // Check if pipeline already exists
    const existingPipeline = await OnboardingPipeline.findOne({
      newHire: newHire._id,
      organization: organization._id
    });

    if (!existingPipeline) {
      // Generate tasks from template
      const startDateObj = new Date(pipelineData.startDate);
      const tasks = createdTemplates[0].checklistItems.map(item => ({
        id: require('uuid').v4(),
        templateItemId: item.id,
        title: item.title,
        description: item.description,
        taskType: item.taskType,
        assignedRole: item.ownerRole,
        dueDate: new Date(startDateObj.getTime() + (item.relativeDueDate * 24 * 60 * 60 * 1000)),
        slaHours: item.slaHours,
        dependencies: item.dependencies || [],
        metadata: {}
      }));

      pipelineData.tasks = tasks;
      pipelineData.totalTasksCount = tasks.length;
      pipelineData.completedTasksCount = 0;
      pipelineData.progressPercentage = 0;

      // Add initial audit log entry
      pipelineData.auditLog = [{
        action: 'Onboarding created',
        performedBy: adminUser._id,
        details: {
          template: createdTemplates[0].name,
          startDate: pipelineData.startDate,
          position: pipelineData.position,
          department: pipelineData.department
        }
      }];

      // Add initial stage history
      pipelineData.stageHistory = [{
        stage: 'preboarding',
        enteredBy: adminUser._id,
        notes: 'Onboarding process initiated with sample data'
      }];

      const pipeline = await OnboardingPipeline.create(pipelineData);
      console.log(`🚀 Created sample onboarding pipeline for ${newHire.fullName || newHire.firstName + ' ' + newHire.lastName}`);
      console.log(`📱 Preboarding URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/preboarding/${pipeline.preboardingToken}`);
    } else {
      console.log(`🚀 Onboarding pipeline already exists for ${newHire.fullName || newHire.firstName + ' ' + newHire.lastName}`);
    }

    console.log('\n🎉 Onboarding data seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Organization: ${organization.name}`);
    console.log(`   - Templates created: ${createdTemplates.length}`);
    console.log(`   - Sample new hire: ${newHire.fullName || newHire.firstName + ' ' + newHire.lastName} (${newHire.email})`);
    console.log(`   - Admin user: ${adminUser.fullName || adminUser.firstName + ' ' + adminUser.lastName || adminUser.email} (${adminUser.email})`);
    console.log('\n🚀 You can now:');
    console.log('   1. Log in as admin to view the onboarding dashboard');
    console.log('   2. Navigate to People > Onboarding to see the pipeline');
    console.log('   3. Use the preboarding URL for the new hire portal');
    console.log('\n💡 Note: This is demo data. In production, you would:');
    console.log('   - Set up real email notifications');
    console.log('   - Configure actual equipment management');
    console.log('   - Integrate with real identity providers');
    console.log('   - Set up proper e-signature services');

  } catch (error) {
    console.error('❌ Error seeding onboarding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📚 Database connection closed');
  }
};

// Run the seeding process
const runSeed = async () => {
  await connectDB();
  await seedOnboardingData();
};

// Execute if run directly
if (require.main === module) {
  runSeed();
}

module.exports = { seedOnboardingData };
