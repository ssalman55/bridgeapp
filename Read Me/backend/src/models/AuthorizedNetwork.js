const mongoose = require('mongoose');

const authorizedNetworkSchema = new mongoose.Schema({
  ssid: {
    type: String,
    required: true,
    trim: true
  },
  ipAddresses: [{
    type: String,
    trim: true
  }],
  ipRanges: [{
    type: String,
    trim: true
  }],
  authorized: {
    type: Boolean,
    default: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, {
  timestamps: true
});

// Add index for faster queries
authorizedNetworkSchema.index({ organization: 1, ssid: 1 }, { unique: true });

const AuthorizedNetwork = mongoose.model('AuthorizedNetwork', authorizedNetworkSchema);

module.exports = AuthorizedNetwork; 