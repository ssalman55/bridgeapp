const mongoose = require('mongoose');

/**
 * UserToken Schema
 * Stores OAuth tokens for cloud providers (OneDrive, Google Drive)
 */
const userTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['microsoft', 'google'],
    index: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  scopes: [{
    type: String
  }],
  tokenType: {
    type: String,
    default: 'Bearer'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
userTokenSchema.index({ userId: 1, provider: 1 }, { unique: true });

// Method to check if token is expired
userTokenSchema.methods.isExpired = function() {
  return new Date() >= this.expiresAt;
};

// Method to check if token expires soon (within 5 minutes)
userTokenSchema.methods.expiresSoon = function() {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return this.expiresAt <= fiveMinutesFromNow;
};

// Static method to find valid token for user and provider
userTokenSchema.statics.findValidToken = async function(userId, provider) {
  const token = await this.findOne({ userId, provider });
  
  if (!token) {
    return null;
  }
  
  if (token.isExpired()) {
    // Token is expired, should be refreshed
    return { token, needsRefresh: true };
  }
  
  if (token.expiresSoon()) {
    // Token expires soon, should be refreshed proactively
    return { token, needsRefresh: true };
  }
  
  return { token, needsRefresh: false };
};

// Static method to store or update token
userTokenSchema.statics.storeToken = async function(userId, organizationId, provider, tokenData) {
  const { access_token, refresh_token, expires_in, scope, token_type } = tokenData;
  
  const expiresAt = new Date(Date.now() + (expires_in * 1000));
  const scopes = scope ? scope.split(' ') : [];
  
  const tokenDoc = await this.findOneAndUpdate(
    { userId, provider },
    {
      userId,
      organizationId,
      provider,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      scopes,
      tokenType: token_type || 'Bearer',
      updatedAt: new Date()
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
  
  return tokenDoc;
};

module.exports = mongoose.model('UserToken', userTokenSchema);

