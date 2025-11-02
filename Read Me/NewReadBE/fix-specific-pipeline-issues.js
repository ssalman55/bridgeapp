// Script to fix the specific pipeline issues found
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const OnboardingPipeline = require('./src/models/OnboardingPipeline');
const OnboardingTask = require('./src/models/OnboardingTask');
const OnboardingTemplate = require('./src/models/OnboardingTemplate');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function fixSpecificPipelineIssues() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Issue 1: Fix orphaned pipeline (Pipeline 1)
    console.log('\n🔧 Fixing Issue 1: Orphaned Pipeline');
    const orphanedPipelineId = '68c3c0ae4d46cef9e2d5764e';
    const orphanedPipeline = await OnboardingPipeline.findById(orphanedPipelineId);
    
    if (orphanedPipeline) {
      console.log(`   Found orphaned pipeline: ${orphanedPipelineId}`);
      
      // Delete the orphaned pipeline and its tasks
      const taskDeleteResult = await OnboardingTask.deleteMany({
        onboarding: orphanedPipelineId
      });
      console.log(`   ✅ Deleted ${taskDeleteResult.deletedCount} orphaned tasks`);
      
      await OnboardingPipeline.findByIdAndDelete(orphanedPipelineId);
      console.log(`   ✅ Deleted orphaned pipeline ${orphanedPipelineId}`);
    }

    // Issue 2: Fix inactive user (Pipeline 2)
    console.log('\n🔧 Fixing Issue 2: Inactive User');
    const fredDavis = await User.findOne({ email: 'support@stfbridge.com' });
    
    if (fredDavis) {
      console.log(`   Found Fred Davis: ${fredDavis._id}`);
      console.log(`   Current isActive: ${fredDavis.isActive}`);
      
      // Activate the user
      await User.findByIdAndUpdate(fredDavis._id, { 
        isActive: true 
      });
      console.log(`   ✅ Activated Fred Davis`);
    }

    // Issue 3: Check if there are any other inactive users that need activation
    console.log('\n🔧 Fixing Issue 3: Other Inactive Users');
    const inactiveUsers = await User.find({ 
      isActive: { $ne: true },
      role: 'staff'
    });
    
    console.log(`   Found ${inactiveUsers.length} inactive staff users`);
    
    if (inactiveUsers.length > 0) {
      // Activate all staff users
      await User.updateMany(
        { role: 'staff', isActive: { $ne: true } },
        { isActive: true }
      );
      console.log(`   ✅ Activated all ${inactiveUsers.length} inactive staff users`);
    }

    // Verify the fixes
    console.log('\n🔍 Verifying fixes...');
    
    // Check pipelines
    const pipelines = await OnboardingPipeline.find()
      .populate('newHire', 'firstName lastName email isActive')
      .populate('organization', 'name');

    console.log(`\n📊 Pipeline Status After Fix:`);
    pipelines.forEach((pipeline, index) => {
      console.log(`   ${index + 1}. ${pipeline.newHire?.firstName || 'ORPHANED'} ${pipeline.newHire?.lastName || ''}`);
      console.log(`      Email: ${pipeline.newHire?.email || 'N/A'}`);
      console.log(`      Active: ${pipeline.newHire?.isActive || 'N/A'}`);
      console.log(`      Position: ${pipeline.position}`);
      console.log(`      Stage: ${pipeline.currentStage}`);
      console.log(`      Pipeline ID: ${pipeline._id}`);
    });

    // Check users
    const activeUsers = await User.find({ 
      role: 'staff', 
      isActive: true 
    });
    console.log(`\n👥 Active Staff Users: ${activeUsers.length}`);

    // Test the frontend query again
    console.log('\n🔍 Testing Frontend Query After Fix...');
    const frontendPipelines = await OnboardingPipeline.find()
      .populate('newHire', 'firstName lastName email isActive')
      .populate('organization', 'name')
      .populate('template', 'name')
      .sort({ createdAt: -1 });

    console.log(`   ✅ Frontend query successful: ${frontendPipelines.length} pipelines`);
    
    if (frontendPipelines.length > 0) {
      console.log('   Sample pipeline data:');
      const sample = frontendPipelines[0];
      console.log(`     - ID: ${sample._id}`);
      console.log(`     - New Hire: ${sample.newHire?.firstName} ${sample.newHire?.lastName}`);
      console.log(`     - Email: ${sample.newHire?.email}`);
      console.log(`     - Active: ${sample.newHire?.isActive}`);
      console.log(`     - Position: ${sample.position}`);
      console.log(`     - Stage: ${sample.currentStage}`);
    }

    console.log('\n✅ All fixes completed!');
    console.log('   The Pipeline page should now load correctly.');
    console.log('   Try refreshing the page in your browser.');

  } catch (error) {
    console.error('❌ Error fixing pipeline issues:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fixes
fixSpecificPipelineIssues();





