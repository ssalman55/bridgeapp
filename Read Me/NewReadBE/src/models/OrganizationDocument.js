const mongoose = require('mongoose');

const organizationDocumentSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Policy',
      'Guideline',
      'Handbook',
      'Procedure',
      'Form',
      'Template',
      'Announcement',
      'Compliance',
      'Training Material',
      'Other'
    ],
    default: 'Other'
  },
  
  // File Details
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalFileName: {
    type: String,
    required: true,
    trim: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  mimeType: {
    type: String,
    required: true
  },
  
  // Organization & Access
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Version Control
  version: {
    type: String,
    default: '1.0',
    trim: true
  },
  isLatestVersion: {
    type: Boolean,
    default: true
  },
  previousVersions: [{
    version: String,
    s3Key: String,
    fileUrl: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Status & Visibility
  status: {
    type: String,
    enum: ['active', 'archived', 'draft'],
    default: 'active'
  },
  isPublic: {
    type: Boolean,
    default: true // Visible to all staff by default
  },
  
  // Metadata
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  expiryDate: {
    type: Date
  },
  effectiveDate: {
    type: Date
  },
  
  // Upload Information
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  
  // Update Information
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedAt: {
    type: Date
  },
  
  // Analytics
  downloadCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date
  },
  
  // Audit Trail
  downloadHistory: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
organizationDocumentSchema.index({ organization: 1, status: 1 });
organizationDocumentSchema.index({ organization: 1, category: 1 });
organizationDocumentSchema.index({ organization: 1, uploadedBy: 1 });
organizationDocumentSchema.index({ organization: 1, createdAt: -1 });
organizationDocumentSchema.index({ organization: 1, tags: 1 });

// Virtual for file extension
organizationDocumentSchema.virtual('fileExtension').get(function() {
  if (!this.originalFileName) return 'file';
  return this.originalFileName.split('.').pop().toLowerCase();
});

// Virtual for formatted file size
organizationDocumentSchema.virtual('formattedFileSize').get(function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.fileSize === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Method to check if document is expired
organizationDocumentSchema.methods.isExpired = function() {
  return this.expiryDate && new Date() > this.expiryDate;
};

// Method to increment download count
organizationDocumentSchema.methods.recordDownload = async function(userId) {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  
  if (userId) {
    this.downloadHistory.push({
      user: userId,
      downloadedAt: new Date()
    });
    
    // Keep only last 100 downloads in history
    if (this.downloadHistory.length > 100) {
      this.downloadHistory = this.downloadHistory.slice(-100);
    }
  }
  
  await this.save();
};

// Method to increment view count
organizationDocumentSchema.methods.recordView = async function() {
  this.viewCount += 1;
  await this.save();
};

module.exports = mongoose.model('OrganizationDocument', organizationDocumentSchema);

