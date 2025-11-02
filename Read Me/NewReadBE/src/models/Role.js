const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Compound index for name and organization to ensure uniqueness within organization
RoleSchema.index({ name: 1, organization: 1 }, { unique: true });

module.exports = mongoose.model('Role', RoleSchema); 