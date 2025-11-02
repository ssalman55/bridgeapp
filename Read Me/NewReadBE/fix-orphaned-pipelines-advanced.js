// Script to fix orphaned onboarding pipelines with duplicate key handling
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const OnboardingPipeline = require('./src/models/OnboardingPipeline');
const OnboardingTask = require('./src/models/OnboardingTask');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function fixOrphanedPipelinesAdvanced() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the orphaned pipeline
    const orphanedPipeline = await OnboardingPipeline.findOne({ newHire: null })
      .populate('organization', 'name');
    
    if (!orphanedPipeline) {
      console.log('✅ No orphaned pipelines found.');
      return;
    }

    console.log(`\n🔍 Found orphaned pipeline: ${orphanedPipeline._id}`);
    console.log(`   Position: ${orphanedPipeline.position}`);
    console.log(`   Department: ${orphanedPipeline.department}`);
    console.log(`   Organization: ${orphanedPipeline.organization.name}`);

    // Find the user (Fred Davis)
    const user = await User.findOne({ email: 'support@stfbridge.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`\n👤 Found user: ${user.firstName} ${user.lastName} (${user.email})`);

    // Check if there's already a pipeline for this user in this organization
    const existingPipeline = await OnboardingPipeline.findOne({
      newHire: user._id,
      organization: orphanedPipeline.organization._id
    });

    if (existingPipeline) {
      console.log(`\n⚠️  Found existing pipeline for this user: ${existingPipeline._id}`);
      console.log('   This explains the duplicate key error.');
      
      // We have two options:
      // 1. Delete the orphaned pipeline and keep the existing one
      // 2. Merge the orphaned pipeline data into the existing one
      
      console.log('\n🔧 Options:');
      console.log('   1. Delete orphaned pipeline (recommended)');
      console.log('   2. Merge orphaned pipeline into existing one');
      
      // For now, let's delete the orphaned pipeline and its tasks
      console.log('\n🗑️  Deleting orphaned pipeline and its tasks...');
      
      // First, delete all tasks associated with the orphaned pipeline
      const taskDeleteResult = await OnboardingTask.deleteMany({
        onboarding: orphanedPipeline._id
      });
      console.log(`   ✅ Deleted ${taskDeleteResult.deletedCount} tasks`);
      
      // Then delete the orphaned pipeline
      await OnboardingPipeline.findByIdAndDelete(orphanedPipeline._id);
      console.log(`   ✅ Deleted orphaned pipeline ${orphanedPipeline._id}`);
      
      console.log('\n✅ Cleanup completed!');
      console.log('   The Pipeline page should now load correctly.');
      
    } else {
      // No existing pipeline, safe to update
      console.log('\n🔧 No existing pipeline found. Updating orphaned pipeline...');
      
      await OnboardingPipeline.findByIdAndUpdate(orphanedPipeline._id, {
        newHire: user._id
      });

      // Update any tasks associated with this pipeline
      await OnboardingTask.updateMany(
        { onboarding: orphanedPipeline._id },
        { 
          $set: { 
            assignedTo: user._id,
            updatedBy: user._id
          }
        }
      );

      console.log('✅ Successfully updated orphaned pipeline');
    }

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const remainingOrphaned = await OnboardingPipeline.countDocuments({ newHire: null });
    console.log(`   Remaining orphaned pipelines: ${remainingOrphaned}`);

    if (remainingOrphaned === 0) {
      console.log('✅ All pipelines now have valid user references!');
    }

    // Show current pipeline status
    const allPipelines = await OnboardingPipeline.find()
      .populate('newHire', 'firstName lastName email')
      .populate('organization', 'name');

    console.log('\n📋 Current Pipeline Status:');
    allPipelines.forEach((pipeline, index) => {
      console.log(`   ${index + 1}. ${pipeline.newHire?.firstName || 'ORPHANED'} ${pipeline.newHire?.lastName || ''}`);
      console.log(`      Position: ${pipeline.position}`);
      console.log(`      Stage: ${pipeline.currentStage}`);
      console.log(`      Email: ${pipeline.newHire?.email || 'N/A'}`);
      console.log(`      Pipeline ID: ${pipeline._id}`);
    });

  } catch (error) {
    console.error('❌ Error fixing orphaned pipelines:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the advanced fix
fixOrphanedPipelinesAdvanced();





