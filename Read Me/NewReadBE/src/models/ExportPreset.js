const mongoose = require('mongoose');

/**
 * Export Preset Model
 * Defines bank-specific CSV/Excel templates with column mappings and formatting rules
 */
const exportPresetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    enum: ['Qatar', 'UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain', 'Oman'],
    trim: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  bankCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  presetType: {
    type: String,
    enum: ['bank-specific', 'generic', 'custom'],
    default: 'generic'
  },
  // File format settings
  fileFormat: {
    type: String,
    enum: ['CSV', 'Excel'],
    default: 'CSV'
  },
  delimiter: {
    type: String,
    default: ','
  },
  encoding: {
    type: String,
    default: 'utf8'
  },
  // Column definitions
  columns: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    header: {
      type: String,
      required: true,
      trim: true
    },
    dataType: {
      type: String,
      enum: ['string', 'number', 'date', 'currency'],
      default: 'string'
    },
    format: {
      type: String, // e.g., 'YYYY-MM-DD', '0.00', 'N0'
      trim: true
    },
    mapping: {
      type: String,
      required: true,
      trim: true // Path to our data model field, e.g., 'employee.fullName', 'payroll.netSalary'
    },
    required: {
      type: Boolean,
      default: false
    },
    maxLength: {
      type: Number
    },
    defaultValue: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  // Validation rules specific to this preset
  validationRules: {
    requiredFields: [{ type: String }],
    fieldFormats: [{
      field: { type: String, required: true },
      pattern: { type: String },
      minLength: { type: Number },
      maxLength: { type: Number }
    }],
    businessRules: [{
      name: { type: String, required: true },
      condition: { type: String, required: true },
      message: { type: String, required: true }
    }]
  },
  // File generation settings
  generationSettings: {
    includeHeader: { type: Boolean, default: true },
    quoteFields: { type: Boolean, default: true },
    dateFormat: { type: String, default: 'YYYY-MM-DD' },
    numberFormat: { type: String, default: '0.00' },
    currencyFormat: { type: String, default: '0.00' }
  },
  // Status and metadata
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  version: { type: String, default: '1.0' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  description: { type: String, trim: true },
  notes: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes
exportPresetSchema.index({ country: 1, bankName: 1, isActive: 1 });
exportPresetSchema.index({ organization: 1, isActive: 1 });
exportPresetSchema.index({ presetType: 1, isDefault: 1 });

// Ensure only one default preset per country
exportPresetSchema.index({ country: 1, isDefault: 1 }, { 
  unique: true, 
  partialFilterExpression: { isDefault: true, isActive: true } 
});

module.exports = mongoose.model('ExportPreset', exportPresetSchema);








