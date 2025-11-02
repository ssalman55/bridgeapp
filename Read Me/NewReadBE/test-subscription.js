const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/staffbridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkSubscription() {
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
    
    const organization = user.organization;
    const now = new Date();
    
    console.log('\n=== Organization Details ===');
    console.log('Name:', organization.name);
    console.log('Plan:', organization.plan);
    console.log('Current subscriptionStatus:', organization.subscriptionStatus);
    console.log('Trial Start Date:', organization.trialStartDate);
    console.log('Trial End Date:', organization.trialEndDate);
    console.log('Subscription Start Date:', organization.subscriptionStartDate);
    console.log('Subscription End Date:', organization.subscriptionEndDate);
    console.log('Current Date:', now);
    
    console.log('\n=== Status Check ===');
    console.log('Is trial ended?', organization.trialEndDate && now > organization.trialEndDate);
    console.log('Is subscription ended?', organization.subscriptionEndDate && now > organization.subscriptionEndDate);
    
    // Check what the API would return
    let currentStatus = organization.subscriptionStatus;
    if (currentStatus === 'trial' && organization.trialEndDate && now > organization.trialEndDate) {
      currentStatus = 'expired';
      console.log('Status should be updated to: expired');
    } else if (currentStatus === 'active' && organization.subscriptionEndDate && now > organization.subscriptionEndDate) {
      currentStatus = 'expired';
      console.log('Status should be updated to: expired');
    }
    
    console.log('Final status:', currentStatus);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkSubscription(); 