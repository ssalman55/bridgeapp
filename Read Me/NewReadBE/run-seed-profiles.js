#!/usr/bin/env node

/**
 * Staff Profile Seeding Script
 * 
 * This script seeds mock profile data for all staff members in the database.
 * It includes comprehensive mock data including banking information with IBAN numbers.
 * 
 * Usage: node run-seed-profiles.js
 */

require('dotenv').config();
const { seedStaffProfiles } = require('./seed-staff-profiles');

console.log('🚀 Starting Staff Profile Seeding Script...');
console.log('📋 This will create/update mock profile data for all staff members');
console.log('💳 Including banking information with Qatar IBAN numbers');
console.log('');

// Run the seeding
seedStaffProfiles().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});




