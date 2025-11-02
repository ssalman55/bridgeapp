const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  // Event Reference
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Timing
  startsAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true
  },
  
  // Location
  location: {
    type: String,
    trim: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  
  // Organization and Visibility
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  visibility: {
    type: String,
    enum: ['private', 'dept', 'org'],
    default: 'org'
  },
  
  // Attendees
  attendeeUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Source tracking
  source: {
    type: String,
    default: 'events-module',
    enum: ['events-module', 'manual', 'imported']
  },
  
  // ICS Feed Information
  icsUid: {
    type: String,
    unique: true,
    sparse: true
  },
  icsSequence: {
    type: Number,
    default: 0
  },
  
  // Recurrence (for future use)
  recurrence: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'cancelled', 'tentative'],
    default: 'active'
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Created/Updated by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for duration
calendarEventSchema.virtual('duration').get(function() {
  return this.endsAt - this.startsAt;
});

// Virtual for isAllDay
calendarEventSchema.virtual('isAllDay').get(function() {
  const duration = this.duration;
  return duration >= 24 * 60 * 60 * 1000; // 24 hours
});

// Indexes for performance
calendarEventSchema.index({ organization: 1, startsAt: 1, endsAt: 1 });
calendarEventSchema.index({ organization: 1, roomId: 1, startsAt: 1, endsAt: 1 });
calendarEventSchema.index({ organization: 1, attendeeUserIds: 1, startsAt: 1 });
calendarEventSchema.index({ eventId: 1 });
calendarEventSchema.index({ icsUid: 1 });
calendarEventSchema.index({ visibility: 1, startsAt: 1 });
calendarEventSchema.index({ status: 1, startsAt: 1 });

// Pre-save middleware
calendarEventSchema.pre('save', function(next) {
  // Ensure endsAt is after startsAt
  if (this.endsAt <= this.startsAt) {
    return next(new Error('End time must be after start time'));
  }
  
  // Generate ICS UID if not present
  if (!this.icsUid) {
    this.icsUid = `${this._id}@${this.organization}`;
  }
  
  next();
});

// Methods
calendarEventSchema.methods.generateICS = function() {
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StaffBridge//Events Module//EN',
    'BEGIN:VEVENT',
    `UID:${this.icsUid}`,
    `DTSTART:${formatDate(this.startsAt)}`,
    `DTEND:${formatDate(this.endsAt)}`,
    `SUMMARY:${this.title}`,
    `DESCRIPTION:${this.description || ''}`,
    `LOCATION:${this.location || ''}`,
    `STATUS:${this.status.toUpperCase()}`,
    `SEQUENCE:${this.icsSequence}`,
    `DTSTAMP:${formatDate(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return ics;
};

calendarEventSchema.methods.isAttendee = function(userId) {
  return this.attendeeUserIds.some(id => id.toString() === userId.toString());
};

calendarEventSchema.methods.canView = function(userId, userRole) {
  // Admin can view all
  if (userRole === 'admin') return true;
  
  // User can view their own events
  if (this.isAttendee(userId)) return true;
  
  // Creator can view
  if (this.createdBy.toString() === userId.toString()) return true;
  
  // Visibility rules
  switch (this.visibility) {
    case 'org':
      return true; // All org members can view
    case 'dept':
      // Would need department checking logic
      return true;
    case 'private':
      return false; // Only attendees and creator
    default:
      return false;
  }
};

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);