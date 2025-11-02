const mongoose = require('mongoose');

/**
 * Payroll Run Model
 * Tracks payroll export runs with audit trail and validation results
 */
const payrollRunSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  period: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/ // Format: YYYY-MM
  },
  payDate: {
    type: Date,
    required: true
  },
  currency: {
    type: String,
    required: true,
    enum: ['QAR', 'AED', 'SAR', 'KWD', 'BHD', 'OMR', 'USD'],
    default: 'QAR'
  },
  // Export configuration
  exportType: {
    type: String,
    enum: ['spreadsheet', 'wps'],
    required: true
  },
  country: {
    type: String,
    enum: ['Qatar', 'UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain', 'Oman'],
    required: function() {
      return this.exportType === 'wps';
    }
  },
  bankPreset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExportPreset'
  },
  wpsProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WPSCountryProfile'
  },
  // File generation settings
  outputSettings: {
    packaging: {
      type: String,
      enum: ['single', 'zip'],
      default: 'single'
    },
    encryption: {
      enabled: { type: Boolean, default: false },
      password: { type: String },
      algorithm: { type: String, default: 'AES-256' }
    },
    retentionDays: { type: Number, default: 90 }
  },
  // Status and workflow
  status: {
    type: String,
    enum: ['draft', 'validating', 'validated', 'generating', 'generated', 'failed', 'locked', 'exported'],
    default: 'draft'
  },
  // Validation results
  validation: {
    isValid: { type: Boolean, default: false },
    errors: [{
      type: { type: String, enum: ['error', 'warning'], required: true },
      category: { type: String, required: true },
      message: { type: String, required: true },
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      field: { type: String },
      suggestedFix: { type: String }
    }],
    summary: {
      totalRecords: { type: Number, default: 0 },
      validRecords: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 }
    },
    validatedAt: { type: Date },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  // File information
  files: [{
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    s3Key: { type: String },
    downloadUrl: { type: String },
    expiresAt: { type: Date },
    sha256: { type: String },
    manifest: { type: mongoose.Schema.Types.Mixed }
  }],
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  exportedAt: { type: Date },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lockedAt: { type: Date },
  // Override and justification
  overrides: [{
    field: { type: String, required: true },
    originalValue: { type: String },
    overrideValue: { type: String, required: true },
    reason: { type: String, required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, default: Date.now }
  }],
  justification: { type: String, trim: true },
  // Statistics
  statistics: {
    totalAmount: { type: Number, default: 0 },
    recordCount: { type: Number, default: 0 },
    processingTimeMs: { type: Number },
    downloadCount: { type: Number, default: 0 },
    lastDownloadedAt: { type: Date }
  }
}, {
  timestamps: true
});

// Indexes
payrollRunSchema.index({ runId: 1 }, { unique: true });
payrollRunSchema.index({ organization: 1, period: 1, exportType: 1 });
payrollRunSchema.index({ status: 1, createdAt: -1 });
payrollRunSchema.index({ createdBy: 1, createdAt: -1 });
payrollRunSchema.index({ 'files.s3Key': 1 });

// Pre-save middleware to generate runId
payrollRunSchema.pre('save', function(next) {
  if (!this.runId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.runId = `PR-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

// Instance methods
payrollRunSchema.methods.addValidationError = function(type, category, message, employeeId = null, field = null, suggestedFix = null) {
  this.validation.errors.push({
    type,
    category,
    message,
    employeeId,
    field,
    suggestedFix
  });
  
  if (type === 'error') {
    this.validation.summary.errorCount++;
  } else {
    this.validation.summary.warningCount++;
  }
};

payrollRunSchema.methods.addFile = function(fileInfo) {
  this.files.push(fileInfo);
};

payrollRunSchema.methods.markAsExported = function(exportedBy) {
  this.status = 'exported';
  this.exportedBy = exportedBy;
  this.exportedAt = new Date();
};

payrollRunSchema.methods.incrementDownloadCount = function() {
  this.statistics.downloadCount++;
  this.statistics.lastDownloadedAt = new Date();
};

module.exports = mongoose.model('PayrollRun', payrollRunSchema);








