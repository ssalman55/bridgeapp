const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other'],
    default: 'Annual',
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  adminComment: {
    type: String,
  },
  actionedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

// Add index for organization for better query performance
LeaveRequestSchema.index({ organization: 1 });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema); 