const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
  },
  location: {
    type: String,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

// Add index for organization for better query performance
calendarEventSchema.index({ organization: 1, date: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema); 