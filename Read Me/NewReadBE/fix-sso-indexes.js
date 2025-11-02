const mongoose = require('mongoose');

// Connect to MongoDB using hardcoded URI (from your Render environment)
const connectDB = async () => {
  try {
    // Use the exact MongoDB URI from your Render environment
    const mongoUri = 'mongodb+srv://ssalman55:Acsdoha123@cluster0.uermh2b.mongodb.net/test';
    
    console.log('Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- Using hardcoded MongoDB URI');
    console.log('- MONGO_URI starts with:', mongoUri.substring(0, 20) + '...');
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

const fixSSOIndexes = async () => {
  try {
    console.log('🔍 Checking SSOAuth collection indexes...');
    
    const db = mongoose.connection.db;
    const collection = db.collection('ssoauths');
    
    // Get current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Check if problematic state_1 index exists
    const stateIndex = indexes.find(index => 
      index.name === 'state_1' || 
      (index.key && index.key.state)
    );
    
    if (stateIndex) {
      console.log('❌ Found problematic state index:', stateIndex);
      console.log('🔧 Dropping state_1 index...');
      
      try {
        await collection.dropIndex('state_1');
        console.log('✅ Successfully dropped state_1 index');
      } catch (error) {
        console.log('⚠️  Could not drop state_1 index:', error.message);
        
        // Try dropping by key pattern
        try {
          await collection.dropIndex({ state: 1 });
          console.log('✅ Successfully dropped state index by key pattern');
        } catch (error2) {
          console.log('⚠️  Could not drop state index by key pattern:', error2.message);
        }
      }
    } else {
      console.log('✅ No problematic state index found');
    }
    
    // Clean up any existing SSOAuth records that might be causing conflicts
    console.log('🧹 Cleaning up potentially conflicting SSOAuth records...');
    
    // Count existing records
    const existingCount = await collection.countDocuments();
    console.log(`📊 Found ${existingCount} existing SSOAuth records`);
    
    if (existingCount > 0) {
      console.log('🗑️  Clearing all existing SSOAuth records to prevent conflicts...');
      const deleteResult = await collection.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deletedCount} SSOAuth records`);
    }
    
    // Verify indexes after cleanup
    console.log('🔍 Verifying indexes after cleanup...');
    const finalIndexes = await collection.indexes();
    console.log('📋 Final indexes:');
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('🎉 SSO index cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing SSO indexes:', error);
    throw error;
  }
};

const main = async () => {
  console.log('🚀 Starting SSO index fix script...');
  await connectDB();
  await fixSSOIndexes();
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
  console.log('🏁 Script completed successfully!');
  process.exit(0);
};

main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
