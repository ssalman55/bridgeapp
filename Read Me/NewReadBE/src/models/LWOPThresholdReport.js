const mongoose = require('mongoose');

const lwopThresholdReportSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  payPeriod: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/ // Format: YYYY-MM
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    required: true
  },
  leaveType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: true
  },
  // Leave details
  leaveStartDate: {
    type: Date,
    required: true
  },
  leaveEndDate: {
    type: Date,
    required: true
  },
  totalRequestedDays: {
    type: Number,
    required: true,
    min: 1
  },
  thresholdDays: {
    type: Number,
    required: true,
    min: 0
  },
  excessLWOPDays: {
    type: Number,
    required: true,
    min: 0
  },
  // Salary calculation details
  baseMonthlySalary: {
    type: Number,
    required: true,
    min: 0
  },
  calendarDaysInMonth: {
    type: Number,
    required: true,
    min: 28,
    max: 31
  },
  dailyRate: {
    type: Number,
    required: true,
    min: 0
  },
  suggestedDeductionAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Document status
  documentStatus: {
    type: String,
    enum: ['required', 'provided', 'missing'],
    required: true
  },
  documentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Posting status
  status: {
    type: String,
    enum: ['unposted', 'posted', 'ignored', 'override'],
    default: 'unposted'
  },
  // Payroll integration
  payrollDeductionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollDeduction'
  },
  // Override/ignore details
  overrideAmount: {
    type: Number,
    min: 0
  },
  justification: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  // Audit fields
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  postedAt: {
    type: Date
  },
  // Calculation trace for audit
  calculationTrace: {
    baseSalary: Number,
    calendarDays: Number,
    dailyRate: Number,
    lwopDays: Number,
    calculationMethod: {
      type: String,
      enum: ['calendar-days', 'working-days'],
      default: 'calendar-days'
    },
    currency: {
      type: String,
      default: 'QAR'
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
lwopThresholdReportSchema.index({ organization: 1, payPeriod: 1 });
lwopThresholdReportSchema.index({ organization: 1, employee: 1, payPeriod: 1 });
lwopThresholdReportSchema.index({ organization: 1, status: 1 });
lwopThresholdReportSchema.index({ leaveRequest: 1 }, { unique: true }); // One report per leave request

// Static methods
lwopThresholdReportSchema.statics.findByOrganizationAndPeriod = function(organizationId, payPeriod) {
  return this.find({
    organization: organizationId,
    payPeriod: payPeriod
  }).populate('employee', 'fullName email department')
    .populate('leaveType', 'name color icon')
    .populate('leaveRequest', 'startDate endDate reason attachments')
    .populate('reviewedBy', 'fullName')
    .populate('postedBy', 'fullName')
    .sort({ createdAt: -1 });
};

lwopThresholdReportSchema.statics.findUnpostedByOrganization = function(organizationId) {
  return this.find({
    organization: organizationId,
    status: 'unposted'
  }).populate('employee', 'fullName email department')
    .populate('leaveType', 'name color icon')
    .populate('leaveRequest', 'startDate endDate reason attachments')
    .sort({ createdAt: -1 });
};

// Instance methods
lwopThresholdReportSchema.methods.markAsReviewed = function(reviewedBy) {
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  return this.save();
};

lwopThresholdReportSchema.methods.markAsPosted = function(postedBy, payrollDeductionId) {
  this.status = 'posted';
  this.postedBy = postedBy;
  this.postedAt = new Date();
  this.payrollDeductionId = payrollDeductionId;
  return this.save();
};

lwopThresholdReportSchema.methods.markAsIgnored = function(reviewedBy, justification) {
  this.status = 'ignored';
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  this.justification = justification;
  return this.save();
};

lwopThresholdReportSchema.methods.markAsOverride = function(reviewedBy, overrideAmount, justification) {
  this.status = 'override';
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  this.overrideAmount = overrideAmount;
  this.justification = justification;
  return this.save();
};

module.exports = mongoose.model('LWOPThresholdReport', lwopThresholdReportSchema);










