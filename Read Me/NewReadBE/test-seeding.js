#!/usr/bin/env node

/**
 * Test Script for Staff Profile Seeding
 * 
 * This script tests the seeding functionality by:
 * 1. Checking database connection
 * 2. Verifying staff members exist
 * 3. Running a small sample of the seeding process
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');
const Organization = require('./src/models/Organization');

async function testSeeding() {
  try {
    console.log('🧪 Testing Staff Profile Seeding...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check organizations
    const organizations = await Organization.find({});
    console.log(`📊 Found ${organizations.length} organization(s)`);
    
    if (organizations.length === 0) {
      console.log('❌ No organizations found. Please create an organization first.');
      return;
    }

    // Check staff members
    const totalStaff = await User.countDocuments({ status: { $ne: 'archived' } });
    console.log(`👥 Found ${totalStaff} total staff members`);

    // Check existing profiles
    const existingProfiles = await StaffProfile.countDocuments();
    console.log(`📋 Found ${existingProfiles} existing staff profiles`);

    // Show sample staff members
    const sampleStaff = await User.find({ status: { $ne: 'archived' } })
      .select('fullName email department role')
      .limit(5);
    
    console.log('\n📝 Sample staff members:');
    sampleStaff.forEach((staff, index) => {
      console.log(`   ${index + 1}. ${staff.fullName} (${staff.email}) - ${staff.department}/${staff.role}`);
    });

    // Check if profiles exist for sample staff
    console.log('\n🔍 Checking existing profiles for sample staff:');
    for (const staff of sampleStaff) {
      const profile = await StaffProfile.findOne({ staffId: staff._id });
      if (profile) {
        console.log(`   ✅ ${staff.fullName}: Profile exists (${profile.completionPercentage}% complete)`);
        if (profile.additionalInfo?.bankAccount) {
          console.log(`      💳 IBAN: ${profile.additionalInfo.bankAccount}`);
        }
      } else {
        console.log(`   ❌ ${staff.fullName}: No profile found`);
      }
    }

    console.log('\n🎯 Ready to run seeding script!');
    console.log('   Run: node run-seed-profiles.js');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testSeeding();




