const mongoose = require('mongoose');
require('dotenv').config();

async function fixUserEmailIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('\n🔍 Checking existing indexes...');
    const existingIndexes = await usersCollection.indexes();
    console.log('Current indexes:', existingIndexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    // Check if the problematic global email index exists
    const globalEmailIndex = existingIndexes.find(idx => 
      idx.key.email === 1 && 
      Object.keys(idx.key).length === 1 && 
      idx.unique === true
    );

    if (globalEmailIndex) {
      console.log(`\n❌ Found problematic global email index: ${globalEmailIndex.name}`);
      console.log('🔧 Dropping global email index...');
      
      try {
        await usersCollection.dropIndex(globalEmailIndex.name);
        console.log('✅ Global email index dropped successfully');
      } catch (dropError) {
        if (dropError.code === 27 || dropError.message.includes('index not found')) {
          console.log('ℹ️ Index was already dropped or doesn\'t exist');
        } else {
          throw dropError;
        }
      }
    } else {
      console.log('✅ No problematic global email index found');
    }

    // Check if the compound index already exists
    const compoundIndex = existingIndexes.find(idx => 
      idx.key.email === 1 && 
      idx.key.organization === 1 && 
      idx.unique === true
    );

    if (!compoundIndex) {
      console.log('\n🔧 Creating compound unique index on email + organization...');
      
      try {
        await usersCollection.createIndex(
          { email: 1, organization: 1 }, 
          { 
            unique: true,
            name: 'email_1_organization_1',
            background: true 
          }
        );
        console.log('✅ Compound unique index created successfully');
      } catch (createError) {
        if (createError.code === 85) {
          console.log('ℹ️ Index already exists');
        } else {
          console.error('❌ Error creating compound index:', createError.message);
          
          // Check for duplicate data that might prevent index creation
          if (createError.code === 11000) {
            console.log('\n🔍 Checking for duplicate email+organization combinations...');
            
            const duplicates = await usersCollection.aggregate([
              {
                $group: {
                  _id: { email: '$email', organization: '$organization' },
                  count: { $sum: 1 },
                  users: { $push: { _id: '$_id', fullName: '$fullName' } }
                }
              },
              {
                $match: { count: { $gt: 1 } }
              }
            ]).toArray();
            
            if (duplicates.length > 0) {
              console.log('❌ Found duplicate email+organization combinations:');
              duplicates.forEach(dup => {
                console.log(`  Email: ${dup._id.email}, Org: ${dup._id.organization}`);
                console.log(`  Users: ${dup.users.map(u => `${u.fullName} (${u._id})`).join(', ')}`);
              });
              console.log('\n⚠️ Please resolve these duplicates manually before creating the index.');
            } else {
              console.log('✅ No duplicates found, but index creation still failed');
            }
            
            throw createError;
          }
        }
      }
    } else {
      console.log('✅ Compound unique index already exists');
    }

    console.log('\n🔍 Final index status:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach(idx => {
      if (idx.key.email) {
        console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
      }
    });

    console.log('\n✅ User email index migration completed successfully!');
    console.log('📧 You can now create onboarding with the same email across different organizations.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

if (require.main === module) {
  fixUserEmailIndexes();
}

module.exports = fixUserEmailIndexes;







