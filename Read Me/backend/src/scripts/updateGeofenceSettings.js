const mongoose = require('mongoose');
const GeofenceSettings = require('../models/GeofenceSettings');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const updateGeofenceSettings = async () => {
  try {
    console.log('Starting GeofenceSettings update...');
    
    // Find all documents that don't have the allowCheckInOutside field
    const documents = await GeofenceSettings.find({
      allowCheckInOutside: { $exists: false }
    });
    
    console.log(`Found ${documents.length} documents without allowCheckInOutside field`);
    
    // Update each document
    for (const doc of documents) {
      console.log(`Updating document ${doc._id} for organization ${doc.organization}`);
      
      // Set allowCheckInOutside to false by default (most restrictive)
      await GeofenceSettings.updateOne(
        { _id: doc._id },
        { $set: { allowCheckInOutside: false } }
      );
    }
    
    console.log('Update completed successfully');
    
    // Show all documents
    const allDocs = await GeofenceSettings.find({});
    console.log('All GeofenceSettings documents:');
    allDocs.forEach(doc => {
      console.log(`- Organization: ${doc.organization}, isEnabled: ${doc.isEnabled}, allowCheckInOutside: ${doc.allowCheckInOutside}`);
    });
    
  } catch (error) {
    console.error('Error updating GeofenceSettings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
connectDB().then(() => {
  updateGeofenceSettings();
}); 