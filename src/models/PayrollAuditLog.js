const mongoose = require('mongoose');

const PayrollAuditLogSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prevValue: { type: String },
  newValue: { type: String },
  notes: { type: String },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true, versionKey: false });

PayrollAuditLogSchema.index({ organization: 1, date: -1 });

// Prevent updates and deletes
PayrollAuditLogSchema.pre('updateOne', function(next) {
  next(new Error('Payroll audit logs are immutable.'));
});
PayrollAuditLogSchema.pre('deleteOne', function(next) {
  next(new Error('Payroll audit logs are immutable.'));
});

module.exports = mongoose.model('PayrollAuditLog', PayrollAuditLogSchema); 