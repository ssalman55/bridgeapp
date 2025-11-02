const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const LetterRequest = require('./src/models/LetterRequest');

// Helper function to extract S3 key from URL
const extractS3KeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch (error) {
    console.error('Error extracting S3 key from URL:', error);
    return null;
  }
};

async function fixLetterS3Keys() {
  try {
    console.log('Starting to fix letter request S3 keys...');
    
    // Find all letter requests with generated documents
    const requests = await LetterRequest.find({
      'generatedDocument': { $exists: true },
      'generatedDocument.fileUrl': { $exists: true }
    });
    
    console.log(`Found ${requests.length} letter requests with generated documents`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const request of requests) {
      try {
        const currentS3Key = request.generatedDocument.s3Key;
        const fileUrl = request.generatedDocument.fileUrl;
        
        // Check if s3Key is invalid
        if (!currentS3Key || typeof currentS3Key !== 'string' || 
            currentS3Key.includes('Reason:') || currentS3Key.includes('{') || 
            currentS3Key.includes('}')) {
          
          console.log(`\nFixing request ${request._id}:`);
          console.log(`  Current s3Key: ${currentS3Key}`);
          console.log(`  File URL: ${fileUrl}`);
          
          // Extract S3 key from URL
          const extractedKey = extractS3KeyFromUrl(fileUrl);
          
          if (extractedKey) {
            request.generatedDocument.s3Key = extractedKey;
            await request.save();
            
            console.log(`  ✅ Fixed s3Key: ${extractedKey}`);
            fixedCount++;
          } else {
            console.log(`  ❌ Failed to extract s3Key from URL`);
            errorCount++;
          }
        } else {
          console.log(`Request ${request._id} already has valid s3Key: ${currentS3Key}`);
        }
      } catch (error) {
        console.error(`Error processing request ${request._id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total requests processed: ${requests.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error fixing letter S3 keys:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the fix
fixLetterS3Keys();









