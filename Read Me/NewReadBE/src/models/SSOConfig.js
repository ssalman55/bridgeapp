const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['microsoft', 'google'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  clientId: {
    type: String,
    required: function() { return this.enabled; }
  },
  clientSecret: {
    type: String,
    required: function() { return this.enabled; }
  },
  redirectUri: {
    type: String,
    required: function() { return this.enabled; }
  },
  tenantId: {
    type: String,
    // Required for Microsoft, optional for Google
    required: function() { return this.enabled && this.provider === 'microsoft'; }
  },
  hostedDomain: {
    type: String,
    // Required for Google, optional for Microsoft
    required: function() { return this.enabled && this.provider === 'google'; }
  },
  allowedDomains: [{
    type: String,
    required: function() { return this.enabled; }
  }],
  roleMapping: [{
    idpGroupId: {
      type: String,
      required: true
    },
    idpGroupName: {
      type: String,
      required: true
    },
    staffBridgeRole: {
      type: String,
      enum: ['admin', 'staff'],
      required: true
    }
  }],
  ssoOnly: {
    type: Boolean,
    default: false
  },
  jitProvisioning: {
    enabled: {
      type: Boolean,
      default: true
    },
    defaultRole: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff'
    },
    defaultDepartment: {
      type: String,
      default: 'General'
    }
  },
  connectionStatus: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'testing'],
    default: 'disconnected'
  },
  lastConnectionTest: {
    type: Date
  },
  lastConnectionError: {
    type: String
  }
});

const breakGlassAdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  }
});

const ssoConfigSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  ssoOnly: {
    type: Boolean,
    default: false
  },
  providers: [providerSchema],
  breakGlassAdmin: breakGlassAdminSchema,
  lastSsoLogin: {
    type: Date
  },
  ssoLoginCount: {
    type: Number,
    default: 0
  },
  settings: {
    enforceMFA: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    },
    maxConcurrentSessions: {
      type: Number,
      default: 3
    }
  }
}, {
  timestamps: true
});

// Indexes
ssoConfigSchema.index({ organization: 1 });
ssoConfigSchema.index({ 'providers.provider': 1 });

// Instance method to get provider configuration
ssoConfigSchema.methods.getProviderConfig = function(provider) {
  return this.providers.find(p => p.provider === provider);
};

// Instance method to check if SSO is enabled for a provider
ssoConfigSchema.methods.isProviderEnabled = function(provider) {
  const providerConfig = this.getProviderConfig(provider);
  return providerConfig && providerConfig.enabled;
};

// Instance method to validate configuration
ssoConfigSchema.methods.validateConfig = function() {
  const errors = [];
  
  for (const provider of this.providers) {
    if (provider.enabled) {
      if (!provider.clientId || !provider.clientSecret || !provider.redirectUri) {
        errors.push(`${provider.provider} provider is enabled but missing required configuration`);
      }
      
      if (provider.provider === 'microsoft' && !provider.tenantId) {
        errors.push('Microsoft provider requires tenant ID');
      }
      
      if (provider.provider === 'google' && !provider.hostedDomain) {
        errors.push('Google provider requires hosted domain');
      }
      
      if (!provider.allowedDomains || provider.allowedDomains.length === 0) {
        errors.push(`${provider.provider} provider requires at least one allowed domain`);
      }
    }
  }
  
  return errors;
};

// Static method to find or create config for organization
ssoConfigSchema.statics.findOrCreateForOrganization = async function(organizationId) {
  let config = await this.findOne({ organization: organizationId });
  
  if (!config) {
    config = new this({
      organization: organizationId,
      providers: [
        {
          provider: 'microsoft',
          enabled: false,
          clientId: '',
          clientSecret: '',
          redirectUri: '',
          tenantId: '',
          allowedDomains: [],
          roleMapping: [],
          ssoOnly: false,
          jitProvisioning: {
            enabled: true,
            defaultRole: 'staff',
            defaultDepartment: 'General'
          }
        },
        {
          provider: 'google',
          enabled: false,
          clientId: '',
          clientSecret: '',
          redirectUri: '',
          hostedDomain: '',
          allowedDomains: [],
          roleMapping: [],
          ssoOnly: false,
          jitProvisioning: {
            enabled: true,
            defaultRole: 'staff',
            defaultDepartment: 'General'
          }
        }
      ]
    });
    await config.save();
  }
  
  return config;
};

module.exports = mongoose.model('SSOConfig', ssoConfigSchema);

