const mongoose = require('mongoose');

const letterTemplateSchema = new mongoose.Schema({
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
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LetterCategory',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  templateContent: {
    type: String,
    required: true
  },
  // Rich formatting options
  formatting: {
    headerFont: {
      family: { type: String, default: 'Arial' },
      size: { type: Number, default: 16 },
      color: { type: String, default: '#000000' },
      bold: { type: Boolean, default: true },
      italic: { type: Boolean, default: false }
    },
    bodyFont: {
      family: { type: String, default: 'Arial' },
      size: { type: Number, default: 12 },
      color: { type: String, default: '#000000' },
      bold: { type: Boolean, default: false },
      italic: { type: Boolean, default: false }
    },
    lineHeight: { type: Number, default: 1.5 },
    margin: {
      top: { type: Number, default: 50 },
      bottom: { type: Number, default: 50 },
      left: { type: Number, default: 50 },
      right: { type: Number, default: 50 }
    }
  },
  // Branding elements
  branding: {
    showLogo: { type: Boolean, default: true },
    logoPosition: { 
      type: String, 
      enum: ['top-left', 'top-center', 'top-right'],
      default: 'top-left'
    },
    logoSize: { type: Number, default: 100 },
    showSignature: { type: Boolean, default: true },
    signaturePosition: { 
      type: String, 
      enum: ['bottom-left', 'bottom-center', 'bottom-right'],
      default: 'bottom-right'
    },
    signatureSize: { type: Number, default: 80 },
    showStamp: { type: Boolean, default: false },
    stampPosition: { 
      type: String, 
      enum: ['bottom-left', 'bottom-center', 'bottom-right'],
      default: 'bottom-left'
    },
    stampSize: { type: Number, default: 60 }
  },
  placeholders: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'date', 'number', 'currency', 'boolean'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  requiresApproval: {
    type: Boolean,
    default: true
  },
  autoApprove: {
    type: Boolean,
    default: false
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
  version: {
    type: String,
    default: '1.0'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for organization and category
letterTemplateSchema.index({ organization: 1, category: 1 });
letterTemplateSchema.index({ organization: 1, isActive: 1 });
letterTemplateSchema.index({ organization: 1, name: 1 }, { unique: true });

// Virtual for request count
letterTemplateSchema.virtual('requestCount', {
  ref: 'LetterRequest',
  localField: '_id',
  foreignField: 'template',
  count: true
});

// Ensure virtuals are included in JSON output
letterTemplateSchema.set('toJSON', { virtuals: true });
letterTemplateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LetterTemplate', letterTemplateSchema);

