const mongoose = require('mongoose');

/**
 * Cloud Import Audit Log Model
 * Tracks all cloud import operations for compliance and monitoring
 */
const cloudImportAuditSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['onedrive', 'googledrive'],
    required: true
  },
  fileId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'quarantined'],
    default: 'pending'
  },
  errorCode: {
    type: String
  },
  errorMessage: {
    type: String
  },
  durationMs: {
    type: Number,
    description: 'Time taken to complete the import in milliseconds'
  },
  virusScanResult: {
    type: String,
    enum: ['clean', 'infected', 'quarantined', 'pending', 'failed']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Additional metadata from the provider'
  },
  // Timestamps
  startedAt: {
    type: Date,
    required: true,
    index: true
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for querying
cloudImportAuditSchema.index({ organization: 1, startedAt: -1 });
cloudImportAuditSchema.index({ user: 1, startedAt: -1 });
cloudImportAuditSchema.index({ provider: 1, startedAt: -1 });
cloudImportAuditSchema.index({ status: 1 });
cloudImportAuditSchema.index({ startedAt: -1 });

// Compound index for common queries
cloudImportAuditSchema.index({ 
  organization: 1, 
  provider: 1, 
  startedAt: -1 
});

module.exports = mongoose.model('CloudImportAudit', cloudImportAuditSchema);

