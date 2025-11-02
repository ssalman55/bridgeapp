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
    enum: ['trial', 'active', 'expired', 'paused'],
    default: 'trial'
  },
  // Suspension fields
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String,
    default: ''
  },
  suspendedAt: {
    type: Date,
    default: null
  },
  suspendedBy: {
    type: String,
    default: ''
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
  ],
  // Extended fields for official letters
  address: {
    type: String,
    trim: true,
    maxlength: 500
  },
  city: {
    type: String,
    trim: true,
    maxlength: 100
  },
  country: {
    type: String,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 50
  },
  website: {
    type: String,
    trim: true,
    maxlength: 200
  },
  taxId: {
    type: String,
    trim: true,
    maxlength: 100
  },
  licenseNumber: {
    type: String,
    trim: true,
    maxlength: 100
  },
  establishedDate: {
    type: Date
  },
  // Organization Linking fields for multi-tenant support
  organizationType: {
    type: String,
    enum: ['standalone', 'head-office', 'branch'],
    default: 'standalone'
  },
  parentHeadOffice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  linkedBranches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }],
  dataSharingConfig: {
    payroll: { 
      level: { type: String, enum: ['none', 'aggregated', 'summary', 'detailed'], default: 'none' },
      fields: { type: [String], default: [] }
    },
    attendance: { 
      level: { type: String, enum: ['none', 'aggregated', 'summary', 'detailed'], default: 'none' },
      fields: { type: [String], default: [] }
    },
    leave: { 
      level: { type: String, enum: ['none', 'aggregated', 'summary', 'detailed'], default: 'none' },
      fields: { type: [String], default: [] }
    },
    documents: { 
      level: { type: String, enum: ['none', 'aggregated', 'summary', 'detailed'], default: 'none' },
      fields: { type: [String], default: [] }
    },
    officialLetters: { 
      level: { type: String, enum: ['none', 'aggregated', 'summary', 'detailed'], default: 'none' },
      fields: { type: [String], default: [] }
    }
  },
  linkingStatus: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active'
  },
  linkedAt: {
    type: Date,
    default: null
  },
  linkedBy: {
    type: String, // Owner/super admin who created the link
    default: null
  },
  // WPS-specific fields
  wpsProfile: {
    country: {
      type: String,
      enum: ['Qatar', 'UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain', 'Oman'],
      trim: true
    },
    employerIdentifiers: {
      // Qatar
      qid: { type: String, trim: true },
      establishmentId: { type: String, trim: true },
      // UAE
      molId: { type: String, trim: true },
      tradeLicense: { type: String, trim: true },
      // Saudi Arabia
      companyId: { type: String, trim: true },
      gosiId: { type: String, trim: true },
      // Kuwait
      civilId: { type: String, trim: true },
      // Bahrain
      crNumber: { type: String, trim: true },
      // Oman
      commercialRegister: { type: String, trim: true }
    },
    defaultBankPreset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExportPreset'
    },
    wpsSettings: {
      enabled: { type: Boolean, default: false },
      requiresApproval: { type: Boolean, default: true },
      autoLockAfterExport: { type: Boolean, default: true },
      retentionDays: { type: Number, default: 90 },
      encryptionRequired: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware to update the updatedAt timestamp
organizationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Helper methods for organization linking
organizationSchema.methods.getLinkedBranches = async function() {
  return await Organization.find({ 
    parentHeadOffice: this._id,
    organizationType: 'branch'
  }).select('name email plan organizationType linkedAt linkingStatus');
};

organizationSchema.methods.getParentHeadOffice = async function() {
  if (this.parentHeadOffice) {
    return await Organization.findById(this.parentHeadOffice)
      .select('name email plan organizationType linkedAt');
  }
  return null;
};

organizationSchema.methods.isHeadOffice = function() {
  return this.organizationType === 'head-office';
};

organizationSchema.methods.isBranch = function() {
  return this.organizationType === 'branch';
};

organizationSchema.methods.isStandalone = function() {
  return this.organizationType === 'standalone';
};

organizationSchema.methods.canLinkToHeadOffice = function() {
  return this.organizationType === 'standalone' && !this.parentHeadOffice;
};

// Static method to get all head offices
organizationSchema.statics.getHeadOffices = function() {
  return this.find({ organizationType: 'head-office' })
    .select('name email plan linkedBranches linkedAt')
    .populate('linkedBranches', 'name email plan linkingStatus');
};

// Static method to get organization network hierarchy
organizationSchema.statics.getOrganizationNetwork = function() {
  return this.aggregate([
    {
      $lookup: {
        from: 'organizations',
        localField: 'linkedBranches',
        foreignField: '_id',
        as: 'branches'
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        organizationType: 1,
        parentHeadOffice: 1,
        linkedBranches: 1,
        linkingStatus: 1,
        linkedAt: 1,
        branches: {
          name: 1,
          email: 1,
          organizationType: 1,
          linkingStatus: 1,
          linkedAt: 1
        }
      }
    }
  ]);
};

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization; 