const mongoose = require('mongoose');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/staffbridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixTrialDate() {
  try {
    // Find the user
    const user = await User.findOne({ email: 'ssalman55@yahoo.com' }).populate('organization');
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:', user.email);
    console.log('Organization:', user.organization.name);
    console.log('Organization ID:', user.organization._id);
    
    // Set trial end date to yesterday (expired)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const organization = await Organization.findById(user.organization._id);
    organization.trialEndDate = yesterday;
    organization.subscriptionStatus = 'trial'; // Ensure it's set to trial
    await organization.save();
    
    console.log('Updated organization trial end date to:', yesterday);
    console.log('Organization subscription status:', organization.subscriptionStatus);
    
    // Verify the change
    const updatedOrg = await Organization.findById(user.organization._id);
    console.log('Verification - Trial end date:', updatedOrg.trialEndDate);
    console.log('Verification - Subscription status:', updatedOrg.subscriptionStatus);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixTrialDate(); 