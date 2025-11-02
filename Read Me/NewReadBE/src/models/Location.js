const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  address: {
    type: String,
    trim: true,
    maxlength: 200
  },
  capacity: {
    type: Number,
    min: 0
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  amenities: [{
    type: String,
    trim: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
locationSchema.index({ organization: 1, name: 1 });
locationSchema.index({ organization: 1, isActive: 1 });

// Methods
locationSchema.methods.canEdit = function(userId, userRole) {
  // Admin can always edit
  if (userRole === 'admin') return true;
  
  // Department admin can edit locations
  if (userRole === 'dept_admin') return true;
  
  return false;
};

module.exports = mongoose.model('Location', locationSchema);





