const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const InventoryItemName = require('../src/models/InventoryItemName');

async function fixInventoryItemNamesIndex() {
  try {
    console.log('Starting InventoryItemName index migration...');
    
    // Drop the existing unique index on 'name' field
    try {
      await mongoose.connection.collections.inventoryitemnames.dropIndex('name_1');
      console.log('✅ Dropped existing unique index on "name" field');
    } catch (error) {
      if (error.code === 26) {
        console.log('ℹ️  Index "name_1" does not exist, skipping...');
      } else {
        console.log('⚠️  Error dropping index:', error.message);
      }
    }
    
    // Create the new compound unique index
    try {
      await InventoryItemName.collection.createIndex(
        { name: 1, organization: 1 }, 
        { unique: true, name: 'name_1_organization_1' }
      );
      console.log('✅ Created new compound unique index on "name" and "organization" fields');
    } catch (error) {
      console.log('⚠️  Error creating compound index:', error.message);
    }
    
    // Verify the new index
    const indexes = await InventoryItemName.collection.indexes();
    console.log('📊 Current indexes:', indexes.map(idx => idx.name));
    
    console.log('✅ InventoryItemName index migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
fixInventoryItemNamesIndex(); 