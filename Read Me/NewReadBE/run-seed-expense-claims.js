#!/usr/bin/env node

/**
 * Expense Claims Data Seeding Runner Script
 * 
 * This script seeds comprehensive mock data for the Expense Claims module
 * including:
 * - Expense claims with various statuses (Pending, Approved, Rejected)
 * - Claims spanning different time periods for monthly/yearly views
 * - Realistic itemized expenses with receipts
 * - Proper approval workflows and logs
 * 
 * The data is designed to provide full testing coverage for:
 * - Pending Claims page
 * - Approved Claims page
 * - Monthly Expense reports
 * - Yearly Expense reports
 * - Expense management features
 */

console.log('🚀 Starting Expense Claims Data Seeding...');
console.log('📋 This will create comprehensive mock data for Expense Claims module');
console.log('💡 Features included:');
console.log('   • Multiple expense categories (Travel, Meals, Office Supplies, etc.)');
console.log('   • Claims with various statuses (Pending, Approved, Rejected)');
console.log('   • Claims spanning 12 months for monthly/yearly reports');
console.log('   • Realistic itemized expenses with receipts');
console.log('   • Proper approval workflows and admin decisions');
console.log('   • Organization-scoped data');
console.log('');

// Import and run the seeding script
require('./seed-expense-claims.js');




