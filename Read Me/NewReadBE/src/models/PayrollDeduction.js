const mongoose = require('mongoose');

const payrollDeductionSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  payroll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payPeriod: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/ // Format: YYYY-MM
  },
  // Deduction details
  code: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // LWOP specific fields
  lwopDetails: {
    leaveRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveRequest'
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType'
    },
    lwopDays: {
      type: Number,
      min: 0
    },
    calculationMethod: {
      type: String,
      enum: ['calendar-days', 'working-days'],
      default: 'calendar-days'
    },
    dailyRate: {
      type: Number,
      min: 0
    },
    baseSalary: {
      type: Number,
      min: 0
    }
  },
  // Status and workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'posted'],
    default: 'pending'
  },
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  postedAt: {
    type: Date
  },
  // Reference to LWOP report
  lwopReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LWOPThresholdReport'
  },
  // Notes and justification
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes for performance
payrollDeductionSchema.index({ organization: 1, payPeriod: 1 });
payrollDeductionSchema.index({ organization: 1, employee: 1, payPeriod: 1 });
payrollDeductionSchema.index({ organization: 1, status: 1 });
payrollDeductionSchema.index({ payroll: 1 });
payrollDeductionSchema.index({ lwopReportId: 1 });

// Static methods
payrollDeductionSchema.statics.findByPayroll = function(payrollId) {
  return this.find({ payroll: payrollId })
    .populate('employee', 'fullName email department')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName')
    .populate('postedBy', 'fullName')
    .populate('lwopDetails.leaveRequest', 'startDate endDate reason')
    .populate('lwopDetails.leaveType', 'name color icon')
    .sort({ createdAt: -1 });
};

payrollDeductionSchema.statics.findByOrganizationAndPeriod = function(organizationId, payPeriod) {
  return this.find({
    organization: organizationId,
    payPeriod: payPeriod
  }).populate('employee', 'fullName email department')
    .populate('payroll', 'payPeriod paymentStatus')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName')
    .populate('postedBy', 'fullName')
    .populate('lwopDetails.leaveRequest', 'startDate endDate reason')
    .populate('lwopDetails.leaveType', 'name color icon')
    .sort({ createdAt: -1 });
};

// Instance methods
payrollDeductionSchema.methods.approve = function(approvedBy, notes) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

payrollDeductionSchema.methods.reject = function(approvedBy, rejectionReason) {
  this.status = 'rejected';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.rejectionReason = rejectionReason;
  return this.save();
};

payrollDeductionSchema.methods.markAsPosted = function(postedBy) {
  this.status = 'posted';
  this.postedBy = postedBy;
  this.postedAt = new Date();
  return this.save();
};

// Pre-save middleware to ensure data consistency
payrollDeductionSchema.pre('save', function(next) {
  // Auto-generate description for LWOP deductions
  if (this.code === 'LWOP' && !this.description) {
    this.description = `Leave Without Pay - ${this.lwopDetails.lwopDays} days`;
  }
  next();
});

module.exports = mongoose.model('PayrollDeduction', payrollDeductionSchema);










