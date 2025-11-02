const mongoose = require('mongoose');

/**
 * WPS Country Profile Model
 * Defines the record structure, field lengths, and validation rules for each country's WPS format
 */
const wpsCountryProfileSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true,
    unique: true,
    enum: ['Qatar', 'UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain', 'Oman'],
    trim: true
  },
  countryCode: {
    type: String,
    required: true,
    unique: true,
    enum: ['QA', 'AE', 'SA', 'KW', 'BH', 'OM'],
    trim: true
  },
  currency: {
    type: String,
    required: true,
    enum: ['QAR', 'AED', 'SAR', 'KWD', 'BHD', 'OMR'],
    default: function() {
      const currencyMap = {
        'Qatar': 'QAR',
        'UAE': 'AED', 
        'Saudi Arabia': 'SAR',
        'Kuwait': 'KWD',
        'Bahrain': 'BHD',
        'Oman': 'OMR'
      };
      return currencyMap[this.country] || 'QAR';
    }
  },
  fileFormat: {
    type: String,
    required: true,
    enum: ['SIF', 'CSV', 'Excel'],
    default: 'SIF'
  },
  fileExtension: {
    type: String,
    required: true,
    default: function() {
      const extensionMap = {
        'SIF': '.sif',
        'CSV': '.csv',
        'Excel': '.xlsx'
      };
      return extensionMap[this.fileFormat] || '.sif';
    }
  },
  // Record structure definition
  recordStructure: {
    header: {
      required: { type: Boolean, default: true },
      fields: [{
        name: { type: String, required: true },
        length: { type: Number, required: true },
        type: { type: String, enum: ['string', 'number', 'date'], required: true },
        format: { type: String }, // e.g., 'YYYYMMDD', '0000000000'
        required: { type: Boolean, default: true },
        description: { type: String }
      }]
    },
    detail: {
      required: { type: Boolean, default: true },
      fields: [{
        name: { type: String, required: true },
        length: { type: Number, required: true },
        type: { type: String, enum: ['string', 'number', 'date'], required: true },
        format: { type: String },
        required: { type: Boolean, default: true },
        description: { type: String },
        mapping: { type: String } // Path to our data model field
      }]
    },
    trailer: {
      required: { type: Boolean, default: true },
      fields: [{
        name: { type: String, required: true },
        length: { type: Number, required: true },
        type: { type: String, enum: ['string', 'number', 'date'], required: true },
        format: { type: String },
        required: { type: Boolean, default: true },
        description: { type: String },
        calculation: { type: String } // e.g., 'sum', 'count'
      }]
    }
  },
  // Validation rules
  validationRules: {
    iban: {
      length: { type: Number, required: true },
      pattern: { type: String, required: true },
      checksum: { type: String, enum: ['mod97', 'custom'], default: 'mod97' }
    },
    nationalId: {
      required: { type: Boolean, default: true },
      pattern: { type: String },
      length: { type: Number }
    },
    employerId: {
      required: { type: Boolean, default: true },
      pattern: { type: String },
      length: { type: Number }
    },
    amountValidation: {
      precision: { type: Number, default: 2 },
      maxAmount: { type: Number },
      minAmount: { type: Number, default: 0.01 }
    }
  },
  // File generation settings
  generationSettings: {
    delimiter: { type: String, default: '|' },
    lineEnding: { type: String, enum: ['\n', '\r\n'], default: '\n' },
    encoding: { type: String, default: 'utf8' },
    padding: { type: String, enum: ['left', 'right', 'none'], default: 'right' },
    paddingChar: { type: String, default: ' ' }
  },
  // Compliance requirements
  compliance: {
    requiresChecksum: { type: Boolean, default: true },
    requiresTrailerValidation: { type: Boolean, default: true },
    maxRecordsPerFile: { type: Number },
    requiresEncryption: { type: Boolean, default: false }
  },
  // Status and metadata
  isActive: { type: Boolean, default: true },
  version: { type: String, default: '1.0' },
  lastUpdated: { type: Date, default: Date.now },
  description: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes
wpsCountryProfileSchema.index({ country: 1, isActive: 1 });
wpsCountryProfileSchema.index({ countryCode: 1 });

module.exports = mongoose.model('WPSCountryProfile', wpsCountryProfileSchema);








