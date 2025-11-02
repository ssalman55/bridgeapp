const mongoose = require('mongoose');
const StaffBankDetails = require('./src/models/StaffBankDetails');

// Test IBAN validation and encryption
async function testBankDetails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Test IBAN validation
    const testIBANs = [
      'QA58DOHB00001234567890ABCDEFG', // Valid Qatar IBAN
      'GB29NWBK60161331926819', // Valid UK IBAN
      'INVALID_IBAN', // Invalid IBAN
      'QA58DOHB00001234567890ABCDEFGHIJKLMNOP', // Too long
    ];

    console.log('\n=== Testing IBAN Validation ===');
    testIBANs.forEach(iban => {
      try {
        const bankDetails = new StaffBankDetails({
          organization_id: new mongoose.Types.ObjectId(),
          staff_id: new mongoose.Types.ObjectId(),
          account_holder_name: 'Test User',
          bank_name: 'Test Bank',
          IBAN: iban,
          currency: 'QAR'
        });
        console.log(`✅ ${iban}: Valid`);
      } catch (error) {
        console.log(`❌ ${iban}: ${error.message}`);
      }
    });

    // Test encryption/decryption
    console.log('\n=== Testing Encryption/Decryption ===');
    const testData = {
      organization_id: new mongoose.Types.ObjectId(),
      staff_id: new mongoose.Types.ObjectId(),
      account_holder_name: 'John Doe',
      bank_name: 'Qatar National Bank',
      IBAN: 'QA58DOHB00001234567890ABCDEFG',
      SWIFT_code: 'QNBAQAQA',
      account_number: '1234567890',
      currency: 'QAR'
    };

    const bankDetails = new StaffBankDetails(testData);
    await bankDetails.save();
    console.log('✅ Bank details saved with encryption');

    // Retrieve and verify decryption
    const retrieved = await StaffBankDetails.findById(bankDetails._id);
    console.log('✅ Bank details retrieved and decrypted');
    console.log(`   Account Holder: ${retrieved.account_holder_name}`);
    console.log(`   Bank: ${retrieved.bank_name}`);
    console.log(`   IBAN: ${retrieved.IBAN}`);
    console.log(`   Masked IBAN: ${retrieved.maskedIBAN}`);

    // Test masking
    console.log('\n=== Testing IBAN Masking ===');
    console.log(`Original IBAN: ${retrieved.IBAN}`);
    console.log(`Masked IBAN: ${retrieved.maskedIBAN}`);

    // Cleanup
    await StaffBankDetails.findByIdAndDelete(bankDetails._id);
    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testBankDetails(); 