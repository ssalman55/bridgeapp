const mongoose = require('mongoose');

const savedReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  filename: {
    type: String,
    required: true
  },
  s3Url: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true
  },
  reportConfig: {
    columns: [{
      id: String,
      label: String
    }],
    groupBy: [{
      id: String,
      label: String
    }],
    filters: [{
      id: String,
      label: String,
      value: String
    }],
    source: String
  },
  recordCount: {
    type: Number,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
savedReportSchema.index({ organization: 1, createdAt: -1 });
savedReportSchema.index({ createdBy: 1, createdAt: -1 });
savedReportSchema.index({ name: 1, organization: 1 });
savedReportSchema.index({ tags: 1 });

// Virtual for formatted file size
savedReportSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Ensure virtual fields are serialized
savedReportSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('SavedReport', savedReportSchema);


































