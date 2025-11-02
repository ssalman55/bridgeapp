const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const EventTemplate = require('./src/models/EventTemplate');
const Organization = require('./src/models/Organization');
const User = require('./src/models/User');

async function seedEventTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the first organization
    const org = await Organization.findOne();
    if (!org) {
      console.log('❌ No organization found');
      return;
    }

    // Get the first admin user
    const adminUser = await User.findOne({ 
      organization: org._id, 
      role: 'admin' 
    });
    if (!adminUser) {
      console.log('❌ No admin user found');
      return;
    }

    console.log(`📊 Seeding event templates for organization: ${org.name}`);

    // Define system event templates
    const systemTemplates = [
      {
        name: 'School Assembly',
        description: 'Template for school-wide assemblies and gatherings',
        category: 'Assembly',
        organization: org._id,
        defaultToggles: {
          refreshments: true,
          equipment: true,
          facilities: true,
          security: true,
          av: true
        },
        defaultDuration: 60,
        defaultAttendanceMode: 'in-person',
        tasks: [
          {
            title: 'Set up AV equipment',
            description: 'Prepare microphones, speakers, and projection system',
            area: 'AV',
            assignedRole: 'av-team',
            dueDateOffset: 1,
            priority: 'high',
            isRequired: true,
            conditionalOn: 'av'
          },
          {
            title: 'Arrange seating',
            description: 'Set up chairs and ensure proper spacing',
            area: 'Facilities',
            assignedRole: 'facilities-team',
            dueDateOffset: 1,
            priority: 'medium',
            isRequired: true,
            conditionalOn: 'facilities'
          },
          {
            title: 'Prepare refreshments',
            description: 'Set up water stations and light snacks',
            area: 'Catering',
            assignedRole: 'catering-team',
            dueDateOffset: 0,
            priority: 'low',
            isRequired: true,
            conditionalOn: 'refreshments'
          },
          {
            title: 'Security briefing',
            description: 'Brief security team on event details',
            area: 'Security',
            assignedRole: 'security-team',
            dueDateOffset: 1,
            priority: 'high',
            isRequired: true,
            conditionalOn: 'security'
          }
        ],
        checklist: [
          {
            title: 'Test AV equipment',
            description: 'Ensure all audio and visual equipment is working',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'av'
          },
          {
            title: 'Check emergency exits',
            description: 'Ensure all emergency exits are clear and accessible',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'security'
          },
          {
            title: 'Arrange refreshments',
            description: 'Set up refreshment stations',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'refreshments'
          }
        ],
        reminders: [
          {
            type: 'email',
            triggerOffset: 24,
            recipients: 'assignees',
            message: 'Assembly preparation reminder - 24 hours to go',
            isDefault: true
          },
          {
            type: 'email',
            triggerOffset: 2,
            recipients: 'attendees',
            message: 'Assembly starting in 2 hours',
            isDefault: true
          },
          {
            type: 'in-app',
            triggerOffset: 0.5,
            recipients: 'all',
            message: 'Assembly starting in 30 minutes',
            isDefault: true
          }
        ],
        defaultNotes: 'Please ensure all equipment is tested and ready before the event starts.',
        isSystem: true,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      },
      {
        name: 'Parent Evening',
        description: 'Template for parent-teacher conferences and meetings',
        category: 'Parent Evening',
        organization: org._id,
        defaultToggles: {
          refreshments: true,
          equipment: false,
          facilities: true,
          security: false,
          av: false
        },
        defaultDuration: 120,
        defaultAttendanceMode: 'in-person',
        tasks: [
          {
            title: 'Prepare meeting rooms',
            description: 'Set up tables and chairs for parent meetings',
            area: 'Facilities',
            assignedRole: 'facilities-team',
            dueDateOffset: 1,
            priority: 'high',
            isRequired: true,
            conditionalOn: 'facilities'
          },
          {
            title: 'Arrange refreshments',
            description: 'Set up coffee, tea, and light snacks',
            area: 'Catering',
            assignedRole: 'catering-team',
            dueDateOffset: 0,
            priority: 'medium',
            isRequired: true,
            conditionalOn: 'refreshments'
          },
          {
            title: 'Prepare welcome materials',
            description: 'Print schedules and prepare welcome packets',
            area: 'General',
            assignedRole: 'general-staff',
            dueDateOffset: 1,
            priority: 'medium',
            isRequired: true
          }
        ],
        checklist: [
          {
            title: 'Check room availability',
            description: 'Ensure all meeting rooms are available and clean',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'facilities'
          },
          {
            title: 'Set up refreshments',
            description: 'Arrange refreshment stations',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'refreshments'
          },
          {
            title: 'Prepare welcome desk',
            description: 'Set up welcome desk with schedules and materials',
            dueDateOffset: 0,
            isRequired: true
          }
        ],
        reminders: [
          {
            type: 'email',
            triggerOffset: 24,
            recipients: 'attendees',
            message: 'Parent evening reminder - tomorrow at scheduled time',
            isDefault: true
          },
          {
            type: 'email',
            triggerOffset: 2,
            recipients: 'attendees',
            message: 'Parent evening starting in 2 hours',
            isDefault: true
          }
        ],
        defaultNotes: 'Please ensure all materials are ready and rooms are properly set up.',
        isSystem: true,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      },
      {
        name: 'External Visit',
        description: 'Template for external visits and field trips',
        category: 'External Visit',
        organization: org._id,
        defaultToggles: {
          refreshments: false,
          equipment: true,
          facilities: false,
          security: true,
          av: false
        },
        defaultDuration: 240,
        defaultAttendanceMode: 'in-person',
        tasks: [
          {
            title: 'Obtain permissions',
            description: 'Get necessary permissions and waivers for external visit',
            area: 'General',
            assignedRole: 'general-staff',
            dueDateOffset: 7,
            priority: 'urgent',
            isRequired: true
          },
          {
            title: 'Arrange transportation',
            description: 'Book buses or arrange transportation',
            area: 'General',
            assignedRole: 'general-staff',
            dueDateOffset: 3,
            priority: 'high',
            isRequired: true
          },
          {
            title: 'Prepare equipment',
            description: 'Pack necessary equipment and supplies',
            area: 'General',
            assignedRole: 'general-staff',
            dueDateOffset: 1,
            priority: 'medium',
            isRequired: true,
            conditionalOn: 'equipment'
          },
          {
            title: 'Security briefing',
            description: 'Brief security team on visit details',
            area: 'Security',
            assignedRole: 'security-team',
            dueDateOffset: 1,
            priority: 'high',
            isRequired: true,
            conditionalOn: 'security'
          }
        ],
        checklist: [
          {
            title: 'Check permissions',
            description: 'Verify all necessary permissions are obtained',
            dueDateOffset: 0,
            isRequired: true
          },
          {
            title: 'Confirm transportation',
            description: 'Verify transportation arrangements',
            dueDateOffset: 0,
            isRequired: true
          },
          {
            title: 'Pack equipment',
            description: 'Ensure all equipment is packed and ready',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'equipment'
          },
          {
            title: 'Security check',
            description: 'Complete security briefing',
            dueDateOffset: 0,
            isRequired: true,
            conditionalOn: 'security'
          }
        ],
        reminders: [
          {
            type: 'email',
            triggerOffset: 24,
            recipients: 'attendees',
            message: 'External visit reminder - tomorrow at scheduled time',
            isDefault: true
          },
          {
            type: 'email',
            triggerOffset: 2,
            recipients: 'attendees',
            message: 'External visit departing in 2 hours',
            isDefault: true
          }
        ],
        defaultNotes: 'Please ensure all permissions are obtained and transportation is confirmed.',
        isSystem: true,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      }
    ];

    // Clear existing templates for this organization
    await EventTemplate.deleteMany({ organization: org._id });

    // Create new templates
    const createdTemplates = await EventTemplate.insertMany(systemTemplates);

    console.log(`✅ Created ${createdTemplates.length} event templates:`);
    createdTemplates.forEach(template => {
      console.log(`   - ${template.name} (${template.category})`);
    });

  } catch (error) {
    console.error('❌ Error seeding event templates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seed function
seedEventTemplates();





