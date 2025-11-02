const mongoose = require('mongoose');

/**
 * SSO Configuration Model
 * Stores Single Sign-On settings for organizations including Azure Entra ID configuration
 */
const ssoConfigurationSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  // Azure Entra ID / Microsoft configuration
  azureEntraId: {
    enabled: {
      type: Boolean,
      default: false
    },
    tenantId: {
      type: String,
      trim: true
    },
    clientId: {
      type: String,
      trim: true
    },
    clientSecret: {
      type: String,
      trim: true,
      select: false // Never return secret in queries by default
    },
    redirectUri: {
      type: String,
      trim: true
    },
    scopes: [{
      type: String,
      default: ['user.read', 'Calendars.Read', 'Presence.Read']
    }],
    configuredAt: {
      type: Date
    },
    configuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // General SSO settings
  enableTeamsIntegration: {
    type: Boolean,
    default: false
  },
  teamsCallMode: {
    type: String,
    enum: ['deeplink', 'teams_app', 'teams_web'],
    default: 'deeplink',
    description: 'How to initiate Teams calls: deeplink (web), teams_app (desktop), teams_web (web.teams)'
  },
  // Email integration settings
  enableEmailIntegration: {
    type: Boolean,
    default: false,
    description: 'Enable email integration to show email button on staff profiles'
  },
  // Audit trail
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for organization lookup
ssoConfigurationSchema.index({ organization: 1 });

// Middleware to update timestamp
ssoConfigurationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if Azure Entra ID is enabled
ssoConfigurationSchema.methods.isAzureEntraIdEnabled = function() {
  return this.azureEntraId && this.azureEntraId.enabled && this.azureEntraId.tenantId && this.azureEntraId.clientId;
};

// Method to check if Teams integration is enabled
ssoConfigurationSchema.methods.isTeamsIntegrationEnabled = function() {
  return this.enableTeamsIntegration && this.isAzureEntraIdEnabled();
};

// Method to check if email integration is enabled
ssoConfigurationSchema.methods.isEmailIntegrationEnabled = function() {
  return this.enableEmailIntegration;
};

// Static method to get SSO config for organization
ssoConfigurationSchema.statics.getForOrganization = async function(organizationId) {
  return this.findOne({ organization: organizationId });
};

// Static method to create default config for organization
ssoConfigurationSchema.statics.createDefault = async function(organizationId, userId) {
  return this.create({
    organization: organizationId,
    azureEntraId: {
      enabled: false
    },
    enableTeamsIntegration: false,
    createdAt: new Date(),
    updatedBy: userId
  });
};

module.exports = mongoose.model('SSOConfiguration', ssoConfigurationSchema);
