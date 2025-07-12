const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date
  },
  totalHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day'],
    default: 'present'
  }
});

// Add index for organization for better query performance
attendanceSchema.index({ organization: 1, date: 1 });

// Calculate total hours when checking out
attendanceSchema.pre('save', function(next) {
  if (this.checkOut && this.checkIn) {
    const hours = Math.abs(this.checkOut - this.checkIn) / 36e5; // Convert milliseconds to hours
    this.totalHours = Number(hours.toFixed(2));
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema); 