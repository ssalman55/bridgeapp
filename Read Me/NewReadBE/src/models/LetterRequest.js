const mongoose = require('mongoose');

const letterRequestSchema = new mongoose.Schema({
  requestNumber: {
    type: String,
    unique: true,
    required: true
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LetterTemplate',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LetterCategory',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'generated'],
    default: 'pending'
  },
  requestMessage: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  generatedDocument: {
    filename: String,
    originalName: String,
    s3Key: String,
    fileUrl: String,
    fileSize: Number,
    mimeType: String,
    generatedAt: Date
  },
  approvalDetails: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date
  },
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'submitted', 'approved', 'rejected', 'generated', 'downloaded'],
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    notes: String,
    previousStatus: String,
    newStatus: String
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: Date,
  isUrgent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for organization and status
letterRequestSchema.index({ organization: 1, status: 1 });
letterRequestSchema.index({ organization: 1, employee: 1 });
letterRequestSchema.index({ organization: 1, requestedBy: 1 });
letterRequestSchema.index({ organization: 1, createdAt: -1 });
letterRequestSchema.index({ requestNumber: 1 });

// Pre-save middleware to generate request number
letterRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.requestNumber) {
    try {
      const count = await this.constructor.countDocuments({ organization: this.organization });
      this.requestNumber = `LR-${this.organization.toString().slice(-6)}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating request number:', error);
      // Fallback to timestamp-based number
      this.requestNumber = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
  }
  next();
});

// Method to add audit log entry
letterRequestSchema.methods.addAuditLog = function(action, performedBy, notes = '', previousStatus = null, newStatus = null) {
  this.auditLog.push({
    action,
    performedBy,
    performedAt: new Date(),
    notes,
    previousStatus,
    newStatus
  });
  return this.save();
};

// Virtual for formatted status
letterRequestSchema.virtual('formattedStatus').get(function() {
  const statusMap = {
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'generated': 'Generated'
  };
  return statusMap[this.status] || this.status;
});

// Ensure virtuals are included in JSON output
letterRequestSchema.set('toJSON', { virtuals: true });
letterRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LetterRequest', letterRequestSchema);

