const mongoose = require('mongoose');
require('dotenv').config();

const OnboardingPipeline = require('../src/models/OnboardingPipeline');
const OnboardingTemplate = require('../src/models/OnboardingTemplate');
const OnboardingTask = require('../src/models/OnboardingTask');

async function fixExistingOnboardings() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all onboarding pipelines that don't have corresponding tasks
    const pipelines = await OnboardingPipeline.find({}).populate('template');
    console.log(`Found ${pipelines.length} onboarding pipelines`);

    for (const pipeline of pipelines) {
      console.log(`\nProcessing pipeline ${pipeline._id} for ${pipeline.metadata?.newHireInfo?.fullName || 'Unknown'}`);
      
      // Check if tasks already exist for this pipeline
      const existingTasksCount = await OnboardingTask.countDocuments({ onboarding: pipeline._id });
      console.log(`  Existing tasks: ${existingTasksCount}`);
      
      if (existingTasksCount > 0) {
        console.log(`  Skipping - tasks already exist`);
        continue;
      }

      // Get the template
      if (!pipeline.template && !pipeline.templateSnapshot) {
        console.log(`  Skipping - no template or snapshot found`);
        continue;
      }

      // Use template snapshot if available, otherwise fetch template
      let template = pipeline.templateSnapshot;
      if (!template && pipeline.template) {
        template = await OnboardingTemplate.findById(pipeline.template);
        template = template?.toObject();
      }

      if (!template || !template.checklistItems || template.checklistItems.length === 0) {
        console.log(`  Skipping - no checklist items found`);
        continue;
      }

      console.log(`  Creating ${template.checklistItems.length} tasks from template`);

      // Generate tasks from template checklist items
      const tasksToCreate = template.checklistItems.map((item, index) => {
        const dueDate = new Date(pipeline.startDate);
        dueDate.setDate(dueDate.getDate() + (item.relativeDueDate || 0));
        
        return {
          id: `task_${Date.now()}_${index}`,
          templateItemId: item.id,
          title: item.title,
          description: item.description || '',
          taskType: item.taskType,
          status: 'pending',
          assignedRole: item.ownerRole,
          dueDate: dueDate,
          slaHours: item.slaHours || 24,
          isOverdue: false,
          dependencies: item.dependencies || [],
          dependencyStatus: 'ready',
          metadata: item.metadata || {},
          notes: [],
          files: [],
          onboarding: pipeline._id,
          organization: pipeline.organization,
          createdBy: pipeline.createdBy,
          updatedBy: pipeline.createdBy
        };
      });

      // Create the tasks
      const createdTasks = await OnboardingTask.insertMany(tasksToCreate);
      console.log(`  Created ${createdTasks.length} tasks successfully`);

      // Update pipeline task count
      pipeline.totalTasksCount = createdTasks.length;
      pipeline.progressPercentage = 0;
      await pipeline.save();
      console.log(`  Updated pipeline task count`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('You should now see tasks in the "Manage Tasks" page.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

if (require.main === module) {
  fixExistingOnboardings();
}

module.exports = fixExistingOnboardings;







