const mongoose = require('mongoose');

const ItemizedExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  notes: { type: String },
}, { _id: false });

const ReceiptSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  mimetype: String,
  size: Number,
  url: String,
}, { _id: false });

const ApprovalLogSchema = new mongoose.Schema({
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comment: String,
  date: Date,
}, { _id: false });

const ExpenseClaimSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  title: { type: String, required: true },
  expenseDate: { type: Date, required: true },
  category: { type: String, required: true },
  itemizedExpenses: [ItemizedExpenseSchema],
  totalAmount: { type: Number, required: true },
  receipts: [ReceiptSchema],
  justification: { type: String },
  declaration: { type: Boolean, required: true },
  status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
  approvalLogs: [ApprovalLogSchema],
  submittedAt: { type: Date },
  decisionDate: { type: Date },
  approvedRejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  documentAuditLogs: [{
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    attachedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attachedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ['attached', 'removed'], required: true }
  }],
}, { timestamps: true });

module.exports = mongoose.model('ExpenseClaim', ExpenseClaimSchema);
ExpenseClaimSchema.index({ organization: 1 }); 