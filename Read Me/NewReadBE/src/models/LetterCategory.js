const mongoose = require('mongoose');

const letterCategorySchema = new mongoose.Schema({
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
  },
  color: {
    type: String,
    default: '#1C4E80'
  },
  icon: {
    type: String,
    default: 'FiFileText'
  }
}, {
  timestamps: true
});

// Index for organization and active status
letterCategorySchema.index({ organization: 1, isActive: 1 });
letterCategorySchema.index({ organization: 1, name: 1 }, { unique: true });

// Virtual for template count
letterCategorySchema.virtual('templateCount', {
  ref: 'LetterTemplate',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Ensure virtuals are included in JSON output
letterCategorySchema.set('toJSON', { virtuals: true });
letterCategorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LetterCategory', letterCategorySchema);










