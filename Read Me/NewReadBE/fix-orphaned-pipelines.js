// Script to fix orphaned onboarding pipelines after user deletion
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const OnboardingPipeline = require('./src/models/OnboardingPipeline');
const OnboardingTask = require('./src/models/OnboardingTask');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function fixOrphanedPipelines() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all pipelines
    const pipelines = await OnboardingPipeline.find()
      .populate('newHire', 'firstName lastName email')
      .populate('organization', 'name');

    console.log(`\n📊 Found ${pipelines.length} total pipelines`);

    // Find orphaned pipelines (where newHire is null or deleted)
    const orphanedPipelines = pipelines.filter(pipeline => !pipeline.newHire);
    console.log(`❌ Found ${orphanedPipelines.length} orphaned pipelines`);

    if (orphanedPipelines.length === 0) {
      console.log('✅ No orphaned pipelines found. All pipelines have valid user references.');
      return;
    }

    // Display orphaned pipelines
    console.log('\n🔍 Orphaned Pipelines:');
    orphanedPipelines.forEach((pipeline, index) => {
      console.log(`   ${index + 1}. Pipeline ID: ${pipeline._id}`);
      console.log(`      Position: ${pipeline.position}`);
      console.log(`      Department: ${pipeline.department}`);
      console.log(`      Start Date: ${pipeline.startDate}`);
      console.log(`      Current Stage: ${pipeline.currentStage}`);
      console.log(`      Organization: ${pipeline.organization?.name || 'Unknown'}`);
      console.log(`      New Hire ID: ${pipeline.newHire} (NULL)`);
      console.log('');
    });

    // Find users that might be the recreated "New Hire"
    const potentialUsers = await User.find({
      $or: [
        { firstName: { $regex: /new/i } },
        { lastName: { $regex: /hire/i } },
        { email: { $regex: /new.*hire/i } },
        { email: { $regex: /support@stfbridge.com/i } }
      ]
    });

    console.log(`\n👥 Found ${potentialUsers.length} potential "New Hire" users:`);
    potentialUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. User ID: ${user._id}`);
      console.log(`      Name: ${user.firstName} ${user.lastName}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Role: ${user.role}`);
      console.log(`      Organization: ${user.organization}`);
      console.log(`      Is Active: ${user.isActive}`);
      console.log('');
    });

    if (potentialUsers.length === 0) {
      console.log('❌ No potential "New Hire" users found.');
      console.log('   Please create a new user or provide the correct user ID.');
      return;
    }

    // Ask user to choose which user to use
    console.log('\n🔧 To fix the orphaned pipelines, we need to:');
    console.log('   1. Choose which user should be linked to the orphaned pipelines');
    console.log('   2. Update the pipeline references');
    console.log('   3. Update any task references');

    // For now, let's use the first potential user
    const selectedUser = potentialUsers[0];
    console.log(`\n🎯 Using user: ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`);

    // Update orphaned pipelines
    console.log('\n🔧 Updating orphaned pipelines...');
    let updatedCount = 0;

    for (const pipeline of orphanedPipelines) {
      try {
        // Update the pipeline
        await OnboardingPipeline.findByIdAndUpdate(pipeline._id, {
          newHire: selectedUser._id
        });

        // Update any tasks associated with this pipeline
        await OnboardingTask.updateMany(
          { onboarding: pipeline._id },
          { 
            $set: { 
              assignedTo: selectedUser._id,
              updatedBy: selectedUser._id
            }
          }
        );

        console.log(`   ✅ Updated pipeline ${pipeline._id}`);
        updatedCount++;
      } catch (error) {
        console.log(`   ❌ Failed to update pipeline ${pipeline._id}: ${error.message}`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} pipelines`);

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const fixedPipelines = await OnboardingPipeline.find()
      .populate('newHire', 'firstName lastName email');

    const stillOrphaned = fixedPipelines.filter(p => !p.newHire);
    console.log(`   Remaining orphaned pipelines: ${stillOrphaned.length}`);

    if (stillOrphaned.length === 0) {
      console.log('✅ All pipelines now have valid user references!');
      console.log('   The Pipeline page should now load correctly.');
    } else {
      console.log('⚠️  Some pipelines are still orphaned. Manual intervention may be required.');
    }

    // Show updated pipeline info
    console.log('\n📋 Updated Pipeline Information:');
    const updatedPipelines = fixedPipelines.filter(p => p.newHire);
    updatedPipelines.forEach((pipeline, index) => {
      console.log(`   ${index + 1}. ${pipeline.newHire.firstName} ${pipeline.newHire.lastName}`);
      console.log(`      Position: ${pipeline.position}`);
      console.log(`      Stage: ${pipeline.currentStage}`);
      console.log(`      Email: ${pipeline.newHire.email}`);
    });

  } catch (error) {
    console.error('❌ Error fixing orphaned pipelines:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixOrphanedPipelines();
