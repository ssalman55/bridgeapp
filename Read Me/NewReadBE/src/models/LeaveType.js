const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  allocation: {
    type: Number,
    required: true,
    min: 0,
    max: 365 // Maximum 365 days per year
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#3B82F6', // Default blue color
    match: /^#[0-9A-F]{6}$/i // Hex color validation
  },
  icon: {
    type: String,
    default: 'calendar',
    enum: ['calendar', 'heart', 'baby', 'user', 'clock', 'star', 'home', 'plane', 'medical', 'graduation']
  },
  documentThreshold: {
    enabled: {
      type: Boolean,
      default: false
    },
    days: {
      type: Number,
      min: 1,
      max: 365,
      default: 1
    },
    requiredDocumentTypes: [{
      type: String,
      enum: ['medical', 'certificate', 'other']
    }],
    description: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance and uniqueness
leaveTypeSchema.index({ organization: 1, name: 1 }, { unique: true });
leaveTypeSchema.index({ organization: 1, isActive: 1, isDeleted: false });

// Virtual for active leave types only
leaveTypeSchema.virtual('isActiveType').get(function() {
  return this.isActive && !this.isDeleted;
});

// Instance methods
leaveTypeSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.isActive = false;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

leaveTypeSchema.methods.restore = function(restoredBy) {
  this.isDeleted = false;
  this.isActive = true;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.updatedBy = restoredBy;
  return this.save();
};

// Static methods
leaveTypeSchema.statics.findActiveByOrganization = function(organizationId) {
  return this.find({
    organization: organizationId,
    isActive: true,
    isDeleted: false
  }).sort({ name: 1 });
};

leaveTypeSchema.statics.findByOrganization = function(organizationId) {
  return this.find({
    organization: organizationId,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

// Pre-save middleware
leaveTypeSchema.pre('save', function(next) {
  // Ensure name is properly formatted
  if (this.name) {
    this.name = this.name.trim();
  }
  next();
});

// Pre-update middleware
leaveTypeSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  // Set updatedBy if not already set
  if (this.getUpdate().$set && !this.getUpdate().$set.updatedBy) {
    this.getUpdate().$set.updatedBy = this.getUpdate().$set.updatedBy || this.getUpdate().$set.createdBy;
  }
  next();
});

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
