const mongoose = require('mongoose');

const ssoAuthSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  provider: {
    type: String,
    enum: ['microsoft', 'google'],
    required: true
  },
  providerUserId: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  idToken: {
    type: String
  },
  tokenExpiry: {
    type: Date,
    required: true
  },
  scopes: [{
    type: String
  }],
  sessionId: {
    type: String,
    unique: true,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    loginMethod: {
      type: String,
      enum: ['sso', 'break-glass'],
      default: 'sso'
    }
  }
}, {
  timestamps: true
});

// Indexes
ssoAuthSchema.index({ user: 1, organization: 1 });
ssoAuthSchema.index({ provider: 1, providerUserId: 1 });
ssoAuthSchema.index({ sessionId: 1 });
ssoAuthSchema.index({ tokenExpiry: 1 });
ssoAuthSchema.index({ isActive: 1 });

// Instance method to check if token is expired
ssoAuthSchema.methods.isTokenExpired = function() {
  return new Date() > this.tokenExpiry;
};

// Instance method to check if session is valid
ssoAuthSchema.methods.isSessionValid = function() {
  return this.isActive && !this.isTokenExpired();
};

// Instance method to refresh last used timestamp
ssoAuthSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to deactivate session
ssoAuthSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Static method to find active sessions for a user
ssoAuthSchema.statics.findActiveSessions = function(userId, organizationId) {
  return this.find({
    user: userId,
    organization: organizationId,
    isActive: true,
    tokenExpiry: { $gt: new Date() }
  }).sort({ lastUsed: -1 });
};

// Static method to find session by session ID
ssoAuthSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({
    sessionId,
    isActive: true,
    tokenExpiry: { $gt: new Date() }
  });
};

// Static method to cleanup expired sessions
ssoAuthSchema.statics.cleanupExpiredSessions = function() {
  return this.updateMany(
    { tokenExpiry: { $lt: new Date() } },
    { $set: { isActive: false } }
  );
};

// Static method to revoke all sessions for a user
ssoAuthSchema.statics.revokeAllUserSessions = function(userId, organizationId) {
  return this.updateMany(
    { user: userId, organization: organizationId },
    { $set: { isActive: false } }
  );
};

// Pre-save middleware to generate session ID if not provided
ssoAuthSchema.pre('save', function(next) {
  if (!this.sessionId) {
    this.sessionId = `sso_${this._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('SSOAuth', ssoAuthSchema);








