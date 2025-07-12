const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  salaryStructure: { type: Object, required: true }, // snapshot at payroll time
  payPeriod: { type: String, required: true }, // e.g. '2024-06'
  totalWorkdays: { type: Number, required: true },
  absences: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  bonuses: { type: Number, default: 0 },
  grossSalary: { type: Number, required: true },
  netSalary: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  paymentMethod: { type: String, enum: ['Bank Transfer', 'Cash'], default: 'Bank Transfer' },
  paymentDate: { type: Date },
  bankDetails: {
    bankName: { type: String },
    accountNumber: { type: String },
    ifsc: { type: String },
  },
}, { timestamps: true });

// Ensure only one payroll per staff, organization, and pay period
PayrollSchema.index({ staff: 1, organization: 1, payPeriod: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', PayrollSchema); 