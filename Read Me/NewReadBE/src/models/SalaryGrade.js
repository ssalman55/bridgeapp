const mongoose = require('mongoose');

const SalaryGradeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  description: { type: String },
  structure: {
    basic: { type: Number, required: true },
    allowances: {
      housing: { type: Number, default: 0 },
      transportation: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    deductions: {
      loan: { type: Number, default: 0 },
      lateFines: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    bonuses: { type: Number, default: 0 },
    benefits: { type: Number, default: 0 },
  },
}, { timestamps: true });

// Add compound index for name and organization for uniqueness within organization
SalaryGradeSchema.index({ name: 1, organization: 1 }, { unique: true });

// Add index for organization for better query performance
SalaryGradeSchema.index({ organization: 1 });

module.exports = mongoose.model('SalaryGrade', SalaryGradeSchema);