const mongoose = require('mongoose');
const User = require('../models/User');
const GeofenceSettings = require('../models/GeofenceSettings');
const Geofence = require('../models/Geofence');

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

const checkUserOrganization = async (userEmail) => {
  try {
    console.log(`Checking organization for user: ${userEmail}`);
    
    // Find the user
    const user = await User.findOne({ email: userEmail }).populate('organization');
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:');
    console.log(`- Name: ${user.firstName} ${user.lastName}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Organization: ${user.organization?.name || 'No organization'}`);
    console.log(`- Organization ID: ${user.organization?._id}`);
    
    // Check geofence settings for this organization
    const geofenceSettings = await GeofenceSettings.findOne({ 
      organization: user.organization._id 
    });
    
    console.log('\nGeofence Settings:');
    if (geofenceSettings) {
      console.log(`- isEnabled: ${geofenceSettings.isEnabled}`);
      console.log(`- allowCheckInOutside: ${geofenceSettings.allowCheckInOutside}`);
      console.log(`- Created: ${geofenceSettings.createdAt}`);
      console.log(`- Updated: ${geofenceSettings.updatedAt}`);
    } else {
      console.log('- No geofence settings found for this organization');
    }
    
    // Check geofences for this organization
    const geofences = await Geofence.find({ 
      organization: user.organization._id 
    });
    
    console.log(`\nGeofences (${geofences.length} found):`);
    geofences.forEach((geofence, index) => {
      console.log(`- ${index + 1}. ${geofence.name} (${geofence.latitude}, ${geofence.longitude}) - Radius: ${geofence.radius}m`);
    });
    
  } catch (error) {
    console.error('Error checking user organization:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Get email from command line argument
const userEmail = process.argv[2];
if (!userEmail) {
  console.log('Usage: node checkUserOrganization.js <user-email>');
  process.exit(1);
}

// Run the script
connectDB().then(() => {
  checkUserOrganization(userEmail);
}); 