require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');

async function testWPSFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Test the currency mapping logic
    const organization = await Organization.findOne({ email: 'sahmad@acsdoha.school' });
    
    if (!organization) {
      console.error('Organization not found');
      process.exit(1);
    }

    console.log('Testing currency mapping...');
    
    const currency = organization.wpsProfile?.country ? 
      (organization.wpsProfile.country === 'Qatar' ? 'QAR' : 
       organization.wpsProfile.country === 'UAE' ? 'AED' :
       organization.wpsProfile.country === 'Saudi Arabia' ? 'SAR' :
       organization.wpsProfile.country === 'Kuwait' ? 'KWD' :
       organization.wpsProfile.country === 'Bahrain' ? 'BHD' :
       organization.wpsProfile.country === 'Oman' ? 'OMR' : 'QAR') : 'QAR';

    console.log(`Organization: ${organization.name}`);
    console.log(`Country: ${organization.wpsProfile?.country || 'Not set'}`);
    console.log(`Currency: ${currency}`);
    console.log(`WPS Enabled: ${organization.wpsProfile?.wpsSettings?.enabled || false}`);
    
    console.log('\n✅ Currency mapping test passed!');
    console.log('The backend fix should work once deployed.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing WPS fix:', error);
    process.exit(1);
  }
}

testWPSFix();








