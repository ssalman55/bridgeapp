const mongoose = require('mongoose');

// IBAN validation regex for common formats (more flexible for Qatar and other countries)
const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,30}$/;

const staffBankDetailsSchema = new mongoose.Schema({
  organization_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  account_holder_name: {
    type: String,
    required: [true, 'Account holder name is required'],
    trim: true
  },
  bank_name: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  IBAN: {
    type: String,
    required: [true, 'IBAN is required'],
    trim: true
  },
  SWIFT_code: {
    type: String,
    trim: true,
    uppercase: true
  },
  account_number: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    default: 'QAR',
    enum: ['QAR', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'BHD', 'OMR', 'JOD']
  },
  status: {
    type: String,
    enum: ['pending_verification', 'active', 'rejected'],
    default: 'pending_verification'
  },
  verification_notes: {
    type: String,
    trim: true
  },
  verified_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verified_at: {
    type: Date
  },
  // WPS-specific fields
  wpsDetails: {
    isPrimary: { type: Boolean, default: true },
    bankCode: { type: String, trim: true },
    branchCode: { type: String, trim: true },
    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
      default: 'salary'
    },
    isWpsEligible: { type: Boolean, default: true },
    lastWpsExport: { type: Date },
    wpsExportCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Ensure only one bank details record per staff per organization
staffBankDetailsSchema.index({ staff_id: 1, organization_id: 1 }, { unique: true });

// Index for efficient queries
staffBankDetailsSchema.index({ organization_id: 1, status: 1 });
staffBankDetailsSchema.index({ staff_id: 1 });

// Virtual for masked IBAN (last 4 digits only)
staffBankDetailsSchema.virtual('maskedIBAN').get(function() {
  const iban = this.IBAN;
  if (!iban || iban.length < 4) return iban;
  return '****' + iban.slice(-4);
});

// Pre-save middleware to validate and clean IBAN
staffBankDetailsSchema.pre('save', function(next) {
  if (this.isModified('IBAN') && this.IBAN) {
    // Clean and validate IBAN
    const cleanIBAN = this.IBAN.replace(/\s/g, '').toUpperCase();
    console.log('Validating IBAN:', cleanIBAN, 'Length:', cleanIBAN.length);
    if (!IBAN_REGEX.test(cleanIBAN)) {
      console.log('IBAN validation failed for:', cleanIBAN);
      return next(new Error('Invalid IBAN format'));
    }
    this.IBAN = cleanIBAN;
  }
  next();
});

// Static method to mask IBAN for non-admin users
staffBankDetailsSchema.statics.maskIBAN = function(iban) {
  if (!iban || iban.length < 4) return iban;
  return '****' + iban.slice(-4);
};

// Instance method to verify bank details
staffBankDetailsSchema.methods.verify = function(verifiedBy, notes = '') {
  this.status = 'active';
  this.verified_by = verifiedBy;
  this.verified_at = new Date();
  this.verification_notes = notes;
  return this.save();
};

// Instance method to reject bank details
staffBankDetailsSchema.methods.reject = function(verifiedBy, notes = '') {
  this.status = 'rejected';
  this.verified_by = verifiedBy;
  this.verified_at = new Date();
  this.verification_notes = notes;
  return this.save();
};

module.exports = mongoose.model('StaffBankDetails', staffBankDetailsSchema); 