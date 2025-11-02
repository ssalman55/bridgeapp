const mongoose = require('mongoose');
const OrganizationDocument = require('./src/models/OrganizationDocument');
require('dotenv').config();

async function fixDocumentS3Keys() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');

    // Find all documents
    const documents = await OrganizationDocument.find({});
    console.log(`Found ${documents.length} documents to check`);

    let fixed = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        console.log(`\nChecking document: ${doc._id}`);
        console.log(`  Current s3Key: ${doc.s3Key}`);
        console.log(`  File URL: ${doc.fileUrl}`);

        // Check if s3Key needs fixing
        if (!doc.s3Key || doc.s3Key.includes('Reason:') || doc.s3Key.includes('{') || doc.s3Key.includes('}')) {
          console.log('  -> Invalid s3Key detected, attempting to fix...');
          
          if (doc.fileUrl) {
            try {
              const urlObj = new URL(doc.fileUrl);
              const newS3Key = urlObj.pathname.substring(1); // Remove leading slash
              
              console.log(`  -> New s3Key: ${newS3Key}`);
              
              doc.s3Key = newS3Key;
              await doc.save();
              
              console.log('  ✓ Fixed successfully');
              fixed++;
            } catch (urlError) {
              console.error('  ✗ Error parsing URL:', urlError.message);
              errors++;
            }
          } else {
            console.log('  ✗ No fileUrl available, cannot fix');
            errors++;
          }
        } else {
          console.log('  ✓ s3Key looks valid');
        }
      } catch (docError) {
        console.error(`  ✗ Error processing document ${doc._id}:`, docError.message);
        errors++;
      }
    }

    console.log('\n==========================================');
    console.log(`Total documents checked: ${documents.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Errors: ${errors}`);
    console.log(`Already valid: ${documents.length - fixed - errors}`);
    console.log('==========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

fixDocumentS3Keys();











