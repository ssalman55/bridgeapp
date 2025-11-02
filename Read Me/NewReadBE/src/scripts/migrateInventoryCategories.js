/**
 * Migration script to create InventoryCategory records from existing InventoryItemName categories
 * Run this once to migrate existing category strings to the new InventoryCategory collection
 */

const mongoose = require('mongoose');
const InventoryItemName = require('../models/InventoryItemName');
const InventoryCategory = require('../models/InventoryCategory');
require('dotenv').config();

async function migrateCategories() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/staffbridge';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get all unique categories from InventoryItemName
    const uniqueCategories = await InventoryItemName.distinct('category');
    console.log(`Found ${uniqueCategories.length} unique categories to migrate`);

    // Group by organization to create categories per organization
    const orgCategories = {};
    
    for (const category of uniqueCategories) {
      if (!category || !category.trim()) continue;
      
      // Find all item names with this category
      const itemNames = await InventoryItemName.find({ category }).lean();
      
      for (const itemName of itemNames) {
        const orgId = itemName.organization.toString();
        
        if (!orgCategories[orgId]) {
          orgCategories[orgId] = new Set();
        }
        
        orgCategories[orgId].add(category.trim());
      }
    }

    console.log(`Found categories across ${Object.keys(orgCategories).length} organizations`);

    // Create category records for each organization
    let created = 0;
    let skipped = 0;

    for (const [orgId, categories] of Object.entries(orgCategories)) {
      // Get the first admin user for this organization as createdBy
      const User = require('../models/User');
      const admin = await User.findOne({ organization: orgId, role: 'admin' }).lean();
      
      if (!admin) {
        console.warn(`No admin found for organization ${orgId}, skipping`);
        continue;
      }

      for (const categoryName of categories) {
        // Check if category already exists
        const exists = await InventoryCategory.findOne({
          organization: orgId,
          name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });

        if (!exists) {
          await InventoryCategory.create({
            name: categoryName,
            description: `Auto-migrated category from existing items`,
            icon: 'FiBox',
            color: '#1C4E80',
            organization: orgId,
            createdBy: admin._id,
            isActive: true
          });
          created++;
          console.log(`Created category: "${categoryName}" for org ${orgId}`);
        } else {
          skipped++;
        }
      }
    }

    console.log('\nMigration complete!');
    console.log(`Created: ${created} categories`);
    console.log(`Skipped: ${skipped} (already exist)`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateCategories();
}

module.exports = migrateCategories;

