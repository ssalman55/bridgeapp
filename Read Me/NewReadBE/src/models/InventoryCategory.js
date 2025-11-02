const mongoose = require('mongoose');

const inventoryCategorySchema = new mongoose.Schema({
  // Basic Information
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
  icon: {
    type: String,
    default: 'FiBox'
  },
  color: {
    type: String,
    default: '#1C4E80'
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
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
inventoryCategorySchema.index({ organization: 1, isActive: 1 });
inventoryCategorySchema.index({ organization: 1, name: 1 }, { unique: true });

// Virtual for item count
inventoryCategorySchema.virtual('itemCount', {
  ref: 'InventoryItem',
  localField: 'name',
  foreignField: 'category',
  count: true
});

module.exports = mongoose.model('InventoryCategory', inventoryCategorySchema);

