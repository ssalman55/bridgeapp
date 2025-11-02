const mongoose = require('mongoose');

/**
 * Cloud Import Configuration Model
 * Stores tenant-specific settings for cloud file import features
 */
const cloudImportConfigSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  // Feature flags
  enabled: {
    type: Boolean,
    default: false,
    description: 'Master feature flag for cloud import'
  },
  // Provider-specific settings
  microsoft: {
    enabled: {
      type: Boolean,
      default: false
    },
    requiredScopes: [{
      type: String,
      default: ['Files.Read', 'offline_access', 'User.Read']
    }],
    maxFileSize: {
      type: Number,
      default: 100 * 1024 * 1024 // 100MB default
    }
  },
  google: {
    enabled: {
      type: Boolean,
      default: false
    },
    requiredScopes: [{
      type: String,
      default: [
        'https://www.googleapis.com/auth/drive.readonly',
        'openid',
        'email',
        'profile',
        'offline_access'
      ]
    }],
    maxFileSize: {
      type: Number,
      default: 100 * 1024 * 1024 // 100MB default
    }
  },
  // Global limits
  allowedMimeTypes: [{
    type: String,
    default: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv'
    ]
  }],
  virusScanning: {
    type: Boolean,
    default: true,
    description: 'Enable virus scanning for imported files'
  },
  auditEnabled: {
    type: Boolean,
    default: true,
    description: 'Enable audit logging for cloud imports'
  },
  // Timestamps
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

// Index for organization lookup
cloudImportConfigSchema.index({ organization: 1 });
cloudImportConfigSchema.index({ enabled: 1 });

// Middleware to update timestamp
cloudImportConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get or create config for organization
cloudImportConfigSchema.statics.getForOrganization = async function(organizationId) {
  let config = await this.findOne({ organization: organizationId });
  
  if (!config) {
    config = new this({
      organization: organizationId,
      enabled: false,
      microsoft: {
        enabled: false
      },
      google: {
        enabled: false
      }
    });
    await config.save();
  }
  
  return config;
};

// Method to check if cloud import is enabled for provider
cloudImportConfigSchema.methods.isProviderEnabled = function(provider) {
  if (!this.enabled) return false;
  
  if (provider === 'microsoft' || provider === 'onedrive') {
    return this.microsoft.enabled;
  }
  
  if (provider === 'google' || provider === 'googledrive') {
    return this.google.enabled;
  }
  
  return false;
};

// Method to get allowed MIME types
cloudImportConfigSchema.methods.getAllowedMimeTypes = function() {
  return this.allowedMimeTypes || [];
};

module.exports = mongoose.model('CloudImportConfig', cloudImportConfigSchema);

