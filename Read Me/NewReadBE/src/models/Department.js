const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
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
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
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
departmentSchema.index({ organization: 1, name: 1 });
departmentSchema.index({ organization: 1, isActive: 1 });

// Methods
departmentSchema.methods.canEdit = function(userId, userRole) {
  // Admin can always edit
  if (userRole === 'admin') return true;
  
  // Head of department can edit their department
  if (this.headOfDepartment && this.headOfDepartment.toString() === userId.toString()) {
    return true;
  }
  
  return false;
};

module.exports = mongoose.model('Department', departmentSchema);





