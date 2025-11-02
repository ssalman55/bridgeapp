#!/usr/bin/env node

/**
 * Inventory Data Seeding Runner Script
 * 
 * This script seeds comprehensive mock data for the Assets/Inventory module
 * including:
 * - Inventory item names (categories and item types)
 * - Inventory items with various statuses (In Stock, Low Stock, Out of Stock, Assigned)
 * - Inventory requests with different approval statuses (Pending, Approved, Rejected)
 * 
 * The data is designed to provide full testing coverage for:
 * - Assets summary dashboard
 * - Approved assets page
 * - Rejected assets page  
 * - Assets request page
 * - Inventory management features
 */

console.log('🚀 Starting Inventory Data Seeding...');
console.log('📋 This will create comprehensive mock data for Assets/Inventory module');
console.log('💡 Features included:');
console.log('   • Multiple inventory categories (IT Equipment, Office Supplies, Furniture, etc.)');
console.log('   • Items with various statuses (In Stock, Low Stock, Assigned)');
console.log('   • Items assigned to different staff members');
console.log('   • Inventory requests with Pending, Approved, and Rejected statuses');
console.log('   • Realistic pricing and quantities');
console.log('   • Organization-scoped data');
console.log('');

// Import and run the seeding script
require('./seed-inventory-data.js');




