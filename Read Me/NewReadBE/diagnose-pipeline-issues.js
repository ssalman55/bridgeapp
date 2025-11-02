// Comprehensive diagnostic script for pipeline page issues
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const OnboardingPipeline = require('./src/models/OnboardingPipeline');
const OnboardingTask = require('./src/models/OnboardingTask');
const OnboardingTemplate = require('./src/models/OnboardingTemplate');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function diagnosePipelineIssues() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check all pipelines
    const pipelines = await OnboardingPipeline.find()
      .populate('newHire', 'firstName lastName email isActive')
      .populate('organization', 'name')
      .populate('template', 'name');

    console.log(`\n📊 Total Pipelines: ${pipelines.length}`);

    if (pipelines.length === 0) {
      console.log('❌ No pipelines found! This is why the page is blank.');
      console.log('   You need to create a new onboarding pipeline.');
      return;
    }

    // Check each pipeline
    pipelines.forEach((pipeline, index) => {
      console.log(`\n📋 Pipeline ${index + 1}:`);
      console.log(`   ID: ${pipeline._id}`);
      console.log(`   New Hire: ${pipeline.newHire ? `${pipeline.newHire.firstName} ${pipeline.newHire.lastName}` : 'NULL'}`);
      console.log(`   Email: ${pipeline.newHire?.email || 'N/A'}`);
      console.log(`   Position: ${pipeline.position}`);
      console.log(`   Department: ${pipeline.department}`);
      console.log(`   Start Date: ${pipeline.startDate}`);
      console.log(`   Current Stage: ${pipeline.currentStage}`);
      console.log(`   Organization: ${pipeline.organization?.name || 'N/A'}`);
      console.log(`   Template: ${pipeline.template?.name || 'N/A'}`);
      console.log(`   Preboarding Token: ${pipeline.preboardingToken ? 'Present' : 'Missing'}`);
      console.log(`   Created: ${pipeline.createdAt}`);
      console.log(`   Updated: ${pipeline.updatedAt}`);
      
      // Check for issues
      const issues = [];
      if (!pipeline.newHire) issues.push('Missing newHire reference');
      if (!pipeline.organization) issues.push('Missing organization reference');
      if (!pipeline.template) issues.push('Missing template reference');
      if (!pipeline.preboardingToken) issues.push('Missing preboarding token');
      if (pipeline.newHire && !pipeline.newHire.isActive) issues.push('New hire user is inactive');
      
      if (issues.length > 0) {
        console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
      } else {
        console.log(`   ✅ No issues detected`);
      }
    });

    // Check tasks
    const tasks = await OnboardingTask.find()
      .populate('onboarding', 'position newHire')
      .populate('assignedTo', 'firstName lastName email');

    console.log(`\n📝 Total Tasks: ${tasks.length}`);
    
    if (tasks.length > 0) {
      console.log('\n📋 Task Summary:');
      const taskStats = {};
      tasks.forEach(task => {
        const status = task.status;
        taskStats[status] = (taskStats[status] || 0) + 1;
      });
      
      Object.entries(taskStats).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

      // Check for orphaned tasks
      const orphanedTasks = tasks.filter(task => !task.onboarding);
      if (orphanedTasks.length > 0) {
        console.log(`\n⚠️  Found ${orphanedTasks.length} orphaned tasks (no pipeline reference)`);
      }
    }

    // Check users
    const users = await User.find({ role: 'staff' });
    console.log(`\n👥 Staff Users: ${users.length}`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`      Active: ${user.isActive}`);
      console.log(`      Organization: ${user.organization}`);
    });

    // Test the pipeline query that the frontend would use
    console.log('\n🔍 Testing Frontend Pipeline Query...');
    try {
      // This simulates what the frontend API call would do
      const frontendPipelines = await OnboardingPipeline.find()
        .populate('newHire', 'firstName lastName email')
        .populate('organization', 'name')
        .populate('template', 'name')
        .sort({ createdAt: -1 });

      console.log(`   ✅ Frontend query successful: ${frontendPipelines.length} pipelines`);
      
      if (frontendPipelines.length > 0) {
        console.log('   Sample pipeline data:');
        const sample = frontendPipelines[0];
        console.log(`     - ID: ${sample._id}`);
        console.log(`     - New Hire: ${sample.newHire?.firstName} ${sample.newHire?.lastName}`);
        console.log(`     - Position: ${sample.position}`);
        console.log(`     - Stage: ${sample.currentStage}`);
      }
    } catch (error) {
      console.log(`   ❌ Frontend query failed: ${error.message}`);
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (pipelines.length === 0) {
      console.log('   1. Create a new onboarding pipeline');
      console.log('   2. Make sure you have a valid template');
      console.log('   3. Ensure the new hire user exists and is active');
    } else {
      console.log('   1. Check browser console for JavaScript errors');
      console.log('   2. Verify API endpoints are working');
      console.log('   3. Check network tab for failed requests');
      console.log('   4. Try refreshing the page');
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the diagnosis
diagnosePipelineIssues();
