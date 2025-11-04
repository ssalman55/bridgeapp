const mongoose = require('mongoose');

const oauthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nonce: {
    type: String,
    required: true
  },
  codeVerifier: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['microsoft', 'google']
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Organization'
  },
  sessionId: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['web', 'mobile'],
    default: 'web'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Auto-delete after 5 minutes (300 seconds)
  }
});

// Static method to create and save OAuth state
oauthStateSchema.statics.createState = async function(stateData) {
  const oauthState = new this(stateData);
  return await oauthState.save();
};

// Static method to find and consume OAuth state
oauthStateSchema.statics.findAndConsumeState = async function(state) {
  const oauthState = await this.findOneAndDelete({ state });
  return oauthState;
};

module.exports = mongoose.model('OAuthState', oauthStateSchema);







