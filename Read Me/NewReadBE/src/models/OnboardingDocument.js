const mongoose = require('mongoose');

const signerSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['new-hire', 'manager', 'hr', 'legal', 'admin']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'viewed', 'signed', 'declined'],
    default: 'pending'
  },
  sentAt: Date,
  viewedAt: Date,
  signedAt: Date,
  declinedAt: Date,
  signatureUrl: String,
  ipAddress: String,
  userAgent: String,
  comments: String
}, { _id: false });

const onboardingDocumentSchema = new mongoose.Schema({
  onboarding: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OnboardingPipeline',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Document details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  documentType: {
    type: String,
    required: true,
    enum: ['contract', 'policy', 'handbook', 'form', 'agreement', 'disclosure', 'other']
  },
  packageName: String, // Group related documents
  
  // Document status
  status: {
    type: String,
    required: true,
    enum: ['draft', 'pending', 'sent', 'in-progress', 'completed', 'expired', 'cancelled'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // File information
  templateUrl: String, // Original template
  documentUrl: String, // Generated document
  signedDocumentUrl: String, // Final signed version
  fileSize: Number,
  mimeType: String,
  checksum: String, // For integrity verification
  
  // E-signature details
  eSignProvider: {
    type: String,
    enum: ['docusign', 'hellosign', 'adobe', 'mock'],
    default: 'mock'
  },
  eSignEnvelopeId: String, // External provider ID
  eSignStatus: {
    type: String,
    enum: ['not-started', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided', 'expired'],
    default: 'not-started'
  },
  
  // Signers
  signers: [signerSchema],
  signedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    signedAt: Date,
    signatureMethod: {
      type: String,
      enum: ['electronic', 'digital', 'wet-signature', 'click-to-sign']
    }
  }],
  
  // Timing
  createdAt: {
    type: Date,
    default: Date.now
  },
  sentAt: Date,
  dueDate: Date,
  completedAt: Date,
  expiresAt: Date,
  
  // Settings
  requiresAllSigners: {
    type: Boolean,
    default: true
  },
  allowDecline: {
    type: Boolean,
    default: true
  },
  reminderSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    intervalDays: {
      type: Number,
      default: 3
    },
    maxReminders: {
      type: Number,
      default: 3
    }
  },
  
  // Security
  accessCode: String,
  ipRestrictions: [String],
  authentication: {
    type: String,
    enum: ['none', 'email', 'sms', 'phone', 'knowledge-based'],
    default: 'email'
  },
  
  // Audit and compliance
  auditTrail: [{
    event: String,
    actor: String, // User ID or email
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    details: mongoose.Schema.Types.Mixed
  }],
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  tags: [String],
  
  // Integration data
  externalReferences: [{
    system: String,
    externalId: String,
    url: String
  }],
  
  // Error handling
  errors: [{
    code: String,
    message: String,
    occurredAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
onboardingDocumentSchema.index({ organization: 1, status: 1 });
onboardingDocumentSchema.index({ onboarding: 1, status: 1 });
onboardingDocumentSchema.index({ organization: 1, documentType: 1 });
onboardingDocumentSchema.index({ eSignEnvelopeId: 1 }, { unique: true, sparse: true });
onboardingDocumentSchema.index({ 'signers.email': 1, status: 1 });
onboardingDocumentSchema.index({ dueDate: 1, status: 1 });

// Virtual for overall completion percentage
onboardingDocumentSchema.virtual('completionPercentage').get(function() {
  if (this.signers.length === 0) return 0;
  const signedCount = this.signers.filter(signer => signer.status === 'signed').length;
  return Math.round((signedCount / this.signers.length) * 100);
});

// Method to check if document is fully signed
onboardingDocumentSchema.methods.isFullySigned = function() {
  if (this.signers.length === 0) return false;
  if (this.requiresAllSigners) {
    return this.signers.every(signer => signer.status === 'signed');
  } else {
    return this.signers.some(signer => signer.status === 'signed');
  }
};

// Method to get pending signers
onboardingDocumentSchema.methods.getPendingSigners = function() {
  return this.signers.filter(signer => 
    signer.status === 'pending' || signer.status === 'sent'
  );
};

module.exports = mongoose.model('OnboardingDocument', onboardingDocumentSchema);







