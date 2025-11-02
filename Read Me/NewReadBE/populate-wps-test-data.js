const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');
const StaffBankDetails = require('./src/models/StaffBankDetails');

// Calculate IBAN checksum using MOD-97 algorithm
function calculateIBANChecksum(countryCode, bankCode, accountNumber) {
  // Build IBAN without check digits (use 00 as placeholder)
  const ibanWithoutCheck = `${countryCode}00${bankCode}${accountNumber}`;
  
  // Move first 4 characters to end
  const rearranged = ibanWithoutCheck.substring(4) + ibanWithoutCheck.substring(0, 4);
  
  // Replace letters with numbers (A=10, B=11, ..., Z=35)
  let numericString = '';
  for (let char of rearranged) {
    if (char >= 'A' && char <= 'Z') {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }
  
  // Calculate mod 97
  let remainder = BigInt(numericString) % 97n;
  
  // Check digits = 98 - remainder
  const checkDigits = (98 - Number(remainder)).toString().padStart(2, '0');
  
  return checkDigits;
}

// Generate a valid Qatar IBAN (29 characters) with correct checksum
function generateQatarIBAN() {
  const bankCode = 'DOHB'; // Qatar National Bank code
  // Generate 21-digit account number (without BigInt in random)
  const accountNumber = Math.floor(Math.random() * 1e20).toString().padStart(21, '0');
  
  const checkDigits = calculateIBANChecksum('QA', bankCode, accountNumber);
  
  return `QA${checkDigits}${bankCode}${accountNumber}`;
}

// Generate a valid Qatar National ID (11 digits)
function generateQatarNationalID() {
  const randomDigits = Math.floor(Math.random() * 100000000000).toString().padStart(11, '0');
  return `2${randomDigits.substring(0, 10)}`; // Qatar IDs start with 2
}

async function populateWPSTestData() {
  try {
    // Check if MONGO_URI exists
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('Error: MONGO_URI or MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find users without Qatar National ID (QID)
    const usersWithoutNationalId = await User.find({
      $or: [
        { 'nationalId.qid': { $exists: false } },
        { 'nationalId.qid': null },
        { 'nationalId.qid': '' }
      ]
    });

    console.log(`Found ${usersWithoutNationalId.length} users without Qatar National ID (QID)`);

    // Update users with Qatar National IDs
    let updatedUsers = 0;
    for (const user of usersWithoutNationalId) {
      const qid = generateQatarNationalID();
      
      // Initialize nationalId object if it doesn't exist
      if (!user.nationalId) {
        user.nationalId = {};
      }
      
      user.nationalId.qid = qid;
      await user.save();
      console.log(`  ✓ Updated user ${user.fullName || user.email} with QID: ${qid}`);
      updatedUsers++;
    }

    console.log(`\n✅ Updated ${updatedUsers} users with National IDs\n`);

    // Find bank details with invalid or missing IBAN
    const invalidBankDetails = await StaffBankDetails.find({
      $or: [
        { IBAN: { $exists: false } },
        { IBAN: null },
        { IBAN: '' },
        { IBAN: { $not: /^QA[0-9]{27}$/ } } // Not a valid Qatar IBAN
      ]
    });

    console.log(`Found ${invalidBankDetails.length} bank details with invalid/missing IBAN`);

    // Update bank details with valid Qatar IBANs
    let updatedBankDetails = 0;
    for (const bankDetail of invalidBankDetails) {
      const iban = generateQatarIBAN();
      bankDetail.IBAN = iban;
      
      // Also ensure bank name is set
      if (!bankDetail.bank_name) {
        bankDetail.bank_name = 'Qatar National Bank';
      }
      
      // Ensure WPS details are set
      if (!bankDetail.wpsDetails || !bankDetail.wpsDetails.bankCode) {
        bankDetail.wpsDetails = {
          isPrimary: true,
          bankCode: '001',
          branchCode: '001',
          accountType: 'savings',
          isWpsEligible: true,
          wpsExportCount: 0
        };
      }
      
      await bankDetail.save();
      
      // Get staff name for logging
      const user = await User.findById(bankDetail.staff_id);
      const staffName = user ? (user.fullName || user.email) : 'Unknown';
      
      console.log(`  ✓ Updated bank details for ${staffName} with IBAN: ${iban}`);
      updatedBankDetails++;
    }

    console.log(`\n✅ Updated ${updatedBankDetails} bank details with valid IBANs\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ WPS Test Data Population Complete!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Users updated: ${updatedUsers}`);
    console.log(`  Bank details updated: ${updatedBankDetails}`);
    console.log('\nYou can now generate WPS files successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

populateWPSTestData();

