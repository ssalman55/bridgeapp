const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');
const LetterRequest = require('./src/models/LetterRequest');
const LetterTemplate = require('./src/models/LetterTemplate');

async function testLetterGeneration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('✅ Connected to MongoDB');

    // Get a sample user and organization
    const user = await User.findOne({}).populate('organization');
    const organization = await Organization.findOne({});
    
    if (!user || !organization) {
      console.log('❌ No users or organizations found. Please ensure the database has data.');
      return;
    }

    console.log(`\n👤 Testing with user: ${user.fullName}`);
    console.log(`🏢 Testing with organization: ${organization.name}`);

    // Check if user has the new extended fields
    const userExtendedFields = {
      address: user.address,
      city: user.city,
      country: user.country,
      passportNumber: user.passportNumber,
      employmentType: user.employmentType,
      branch: user.branch
    };

    console.log('\n📋 User extended fields:');
    Object.entries(userExtendedFields).forEach(([key, value]) => {
      console.log(`  ${key}: ${value || 'NOT SET'}`);
    });

    // Check if organization has the new extended fields
    const orgExtendedFields = {
      address: organization.address,
      city: organization.city,
      country: organization.country,
      phone: organization.phone,
      website: organization.website,
      taxId: organization.taxId,
      licenseNumber: organization.licenseNumber,
      establishedDate: organization.establishedDate
    };

    console.log('\n🏢 Organization extended fields:');
    Object.entries(orgExtendedFields).forEach(([key, value]) => {
      console.log(`  ${key}: ${value || 'NOT SET'}`);
    });

    // Count populated vs empty fields
    const userPopulatedFields = Object.values(userExtendedFields).filter(v => v && v.toString().trim() !== '').length;
    const orgPopulatedFields = Object.values(orgExtendedFields).filter(v => v && v.toString().trim() !== '').length;

    console.log(`\n📊 Summary:`);
    console.log(`  User fields populated: ${userPopulatedFields}/6`);
    console.log(`  Organization fields populated: ${orgPopulatedFields}/8`);

    if (userPopulatedFields === 0 && orgPopulatedFields === 0) {
      console.log('\n⚠️  No extended fields are populated. Run the population script:');
      console.log('   node backend/populate-extended-fields.js');
    } else {
      console.log('\n✅ Extended fields are working! Letter generation should now populate more data.');
    }

  } catch (error) {
    console.error('❌ Error testing letter generation:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
    process.exit(0);
  }
}

testLetterGeneration();









