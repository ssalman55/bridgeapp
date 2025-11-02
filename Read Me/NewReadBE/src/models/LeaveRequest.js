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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: true,
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
  totalDays: {
    type: Number,
    required: true,
    min: 1,
  },
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    mimeType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    documentType: {
      type: String,
      enum: ['medical', 'certificate', 'other'],
      default: 'other'
    }
  }],
}, { timestamps: true });

// Add index for organization for better query performance
LeaveRequestSchema.index({ organization: 1 });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema); 