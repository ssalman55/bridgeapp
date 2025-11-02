const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const StaffBankDetails = require('./src/models/StaffBankDetails');

async function enableWPSForBankDetails() {
  try {
    // Check if MONGO_URI exists
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('Error: MONGO_URI or MONGODB_URI not found in environment variables');
      console.log('Please ensure your .env file exists and contains MONGO_URI or MONGODB_URI');
      process.exit(1);
    }
    
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all bank details that don't have WPS details
    const bankDetailsWithoutWPS = await StaffBankDetails.find({
      $or: [
        { 'wpsDetails': { $exists: false } },
        { 'wpsDetails.isWpsEligible': { $ne: true } }
      ]
    });

    console.log(`\nFound ${bankDetailsWithoutWPS.length} bank detail records without WPS eligibility`);

    if (bankDetailsWithoutWPS.length === 0) {
      console.log('All bank details are already WPS-eligible!');
      process.exit(0);
    }

    // Update all bank details to be WPS-eligible
    const result = await StaffBankDetails.updateMany(
      {
        $or: [
          { 'wpsDetails': { $exists: false } },
          { 'wpsDetails.isWpsEligible': { $ne: true } }
        ]
      },
      {
        $set: {
          'wpsDetails': {
            isPrimary: true,
            bankCode: '001', // Default bank code (can be updated later)
            branchCode: '001', // Default branch code
            accountType: 'savings',
            isWpsEligible: true,
            wpsExportCount: 0
          }
        }
      }
    );

    console.log(`\n✅ Successfully updated ${result.modifiedCount} bank detail records`);
    console.log('\nBank details are now WPS-eligible!');
    console.log('You can now generate WPS files for these staff members.');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

enableWPSForBankDetails();

