const mongoose = require('mongoose');

const SalaryStructureSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  basic: { type: Number, required: true },
  housing: { type: Number, default: 0 },
  utility: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  reimbursements: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  taxes: { type: Number, default: 0 },
  notes: { type: String },
  netSalary: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  locked: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['Bank Transfer', 'Cash'], default: 'Bank Transfer' },
  bankDetails: {
    bankName: { type: String },
    accountNumber: { type: String },
    ifsc: { type: String },
  },
}, { timestamps: true });

// Unique per staff per organization
SalaryStructureSchema.index({ staff: 1, organization: 1 }, { unique: true });
SalaryStructureSchema.index({ organization: 1 });

module.exports = mongoose.model('SalaryStructure', SalaryStructureSchema); 