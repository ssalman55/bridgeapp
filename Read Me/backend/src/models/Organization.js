const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Organization email is required'],
    unique: true,
    trim: true
  },
  plan: {
    type: String,
    enum: ['basic', 'professional', 'enterprise'],
    default: 'basic'
  },
  trialStartDate: { type: Date, required: true },
  trialEndDate: { type: Date, required: true },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired'],
    default: 'trial'
  },
  staffLimit: {
    type: Number,
    default: 10
  },
  paymentHistory: [
    {
      amount: Number,
      plan: String,
      date: Date,
      transactionId: String
    }
  ]
}, {
  timestamps: true
});

// Pre-save middleware to update the updatedAt timestamp
organizationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization; 