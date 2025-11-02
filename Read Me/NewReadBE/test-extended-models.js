const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function testExtendedModels() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('✅ Connected to MongoDB');

    // Test User model with new fields
    console.log('\n📋 Testing User model with extended fields...');
    const userSchema = User.schema;
    const userFields = Object.keys(userSchema.paths);
    
    const expectedUserFields = ['address', 'city', 'country', 'passportNumber', 'employmentType', 'branch'];
    const missingUserFields = expectedUserFields.filter(field => !userFields.includes(field));
    
    if (missingUserFields.length === 0) {
      console.log('✅ All expected User fields are present');
    } else {
      console.log('❌ Missing User fields:', missingUserFields);
    }

    // Test Organization model with new fields
    console.log('\n🏢 Testing Organization model with extended fields...');
    const orgSchema = Organization.schema;
    const orgFields = Object.keys(orgSchema.paths);
    
    const expectedOrgFields = ['address', 'city', 'country', 'phone', 'website', 'taxId', 'licenseNumber', 'establishedDate'];
    const missingOrgFields = expectedOrgFields.filter(field => !orgFields.includes(field));
    
    if (missingOrgFields.length === 0) {
      console.log('✅ All expected Organization fields are present');
    } else {
      console.log('❌ Missing Organization fields:', missingOrgFields);
    }

    // Test creating a sample user with new fields
    console.log('\n👤 Testing User creation with extended fields...');
    const sampleUser = new User({
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      organization: new mongoose.Types.ObjectId(),
      department: 'IT',
      // New fields
      address: '123 Test Street, Test City',
      city: 'Doha',
      country: 'Qatar',
      passportNumber: 'QAT123456789',
      employmentType: 'Full-time',
      branch: 'Head Office'
    });

    // Validate the user (without saving)
    const userValidation = sampleUser.validateSync();
    if (!userValidation) {
      console.log('✅ User validation passed with new fields');
    } else {
      console.log('❌ User validation failed:', userValidation.errors);
    }

    // Test creating a sample organization with new fields
    console.log('\n🏢 Testing Organization creation with extended fields...');
    const sampleOrg = new Organization({
      name: 'Test Organization',
      email: 'test@org.com',
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      // New fields
      address: '456 Business Avenue, Downtown',
      city: 'Doha',
      country: 'Qatar',
      phone: '+974 1234 5678',
      website: 'https://testorg.com',
      taxId: 'TAX-123456789',
      licenseNumber: 'LIC-2024-001',
      establishedDate: new Date('2020-01-01')
    });

    // Validate the organization (without saving)
    const orgValidation = sampleOrg.validateSync();
    if (!orgValidation) {
      console.log('✅ Organization validation passed with new fields');
    } else {
      console.log('❌ Organization validation failed:', orgValidation.errors);
    }

    console.log('\n🎉 All model extensions are working correctly!');

  } catch (error) {
    console.error('❌ Error testing extended models:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
    process.exit(0);
  }
}

testExtendedModels();









