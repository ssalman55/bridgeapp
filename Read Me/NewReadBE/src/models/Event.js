const mongoose = require('mongoose');

// Event Task Schema
const eventTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  area: {
    type: String,
    required: true,
    enum: ['IT', 'Facilities', 'Catering', 'Security', 'AV', 'General'],
    default: 'General'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedRole: {
    type: String,
    enum: ['it-team', 'facilities-team', 'catering-team', 'security-team', 'av-team', 'general-staff']
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: {
    type: String,
    trim: true
  },
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Event Checklist Item Schema
const eventChecklistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dueDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Event Reminder Schema
const eventReminderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['email', 'in-app', 'sms'],
    default: 'email'
  },
  triggerAt: {
    type: Date,
    required: true
  },
  recipients: {
    type: String,
    enum: ['assignees', 'attendees', 'all'],
    default: 'attendees'
  },
  message: {
    type: String,
    trim: true
  },
  sent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  }
});

// Event Invitee Schema
const eventInviteeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['attendee', 'organizer', 'presenter'],
    default: 'attendee'
  },
  responseStatus: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'tentative'],
    default: 'pending'
  },
  responseAt: {
    type: Date
  },
  isExternal: {
    type: Boolean,
    default: false
  }
});

// Event Staff Stakeholder Schema
const eventStaffStakeholderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  responsibilities: {
    type: String,
    trim: true
  }
});

// Event Approval Schema
const eventApprovalSchema = new mongoose.Schema({
  required: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  decidedAt: {
    type: Date
  },
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
});

// Main Event Schema
const eventSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['internal', 'external'],
    required: true,
    default: 'internal'
  },
  
  // Organization and Leadership
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  leadUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sponsorDeptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  
  // Location and Timing
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  locationText: {
    type: String,
    trim: true
  },
  startsAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true
  },
  
  // Attendance
  expectedAttendees: {
    type: Number,
    min: 0
  },
  attendanceMode: {
    type: String,
    enum: ['in-person', 'virtual', 'hybrid'],
    default: 'in-person'
  },
  
  // Event Configuration
  toggles: {
    refreshments: {
      type: Boolean,
      default: false
    },
    equipment: {
      type: Boolean,
      default: false
    },
    facilities: {
      type: Boolean,
      default: false
    },
    security: {
      type: Boolean,
      default: false
    },
    av: {
      type: Boolean,
      default: false
    }
  },
  
  // Content and Structure
  notes: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  tasks: [eventTaskSchema],
  checklist: [eventChecklistItemSchema],
  
  // People
  invitees: [eventInviteeSchema],
  externalInvitees: [eventInviteeSchema],
  staffStakeholders: [eventStaffStakeholderSchema],
  
  // Calendar Integration
  calendarEventIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarEvent'
  }],
  
  // Notifications and Reminders
  notifyOnCreate: {
    type: Boolean,
    default: true
  },
  reminders: [eventReminderSchema],
  
  // Status and Approval
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'scheduled', 'in_delivery', 'completed', 'cancelled'],
    default: 'draft'
  },
  approval: eventApprovalSchema,
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    mimeType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Template Reference
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EventTemplate'
  },
  
  // Audit and Metadata
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      trim: true
    },
    changes: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  
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
eventSchema.virtual('duration').get(function() {
  return this.endsAt - this.startsAt;
});

// Virtual for isOverdue
eventSchema.virtual('isOverdue').get(function() {
  return this.status === 'scheduled' && new Date() > this.startsAt;
});

// Virtual for isUpcoming
eventSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  return this.status === 'scheduled' && this.startsAt > now && this.startsAt <= oneHourFromNow;
});

// Indexes for performance
eventSchema.index({ organization: 1, startsAt: 1 });
eventSchema.index({ organization: 1, locationId: 1, startsAt: 1, endsAt: 1 });
eventSchema.index({ organization: 1, status: 1, startsAt: 1 });
eventSchema.index({ organization: 1, leadUserId: 1, startsAt: 1 });
eventSchema.index({ organization: 1, sponsorDeptId: 1, startsAt: 1 });
eventSchema.index({ 'invitees.userId': 1, startsAt: 1 });
eventSchema.index({ 'staffStakeholders.userId': 1, startsAt: 1 });
eventSchema.index({ 'approval.status': 1, 'approval.required': 1 });
eventSchema.index({ createdAt: 1 });

// Pre-save middleware
eventSchema.pre('save', function(next) {
  // Ensure endsAt is after startsAt
  if (this.endsAt <= this.startsAt) {
    return next(new Error('End time must be after start time'));
  }
  
  // Auto-set approval required for staff-created events
  if (this.isNew && this.createdBy && this.createdBy.toString() !== this.leadUserId.toString()) {
    this.approval.required = true;
    this.approval.status = 'pending';
    this.status = 'pending_approval';
  }
  
  next();
});

// Methods
eventSchema.methods.addAuditLog = function(action, performedBy, details, changes) {
  this.auditLog.push({
    action,
    performedBy,
    timestamp: new Date(),
    details,
    changes
  });
};

eventSchema.methods.canView = function(userId, userRole) {
  // Admin can always view
  if (userRole === 'admin') return true;
  
  // Event lead can view
  if (this.leadUserId.toString() === userId.toString()) return true;
  
  // Department admin can view events in their department
  if (userRole === 'dept_admin' && this.sponsorDeptId) {
    // This would need department checking logic
    return true;
  }
  
  // Staff can view events they're invited to or are stakeholders
  if (userRole === 'staff') {
    // Check if user is an invitee
    const isInvitee = this.invitees.some(invitee => 
      invitee.userId.toString() === userId.toString()
    );
    
    // Check if user is a stakeholder
    const isStakeholder = this.staffStakeholders.some(stakeholder => 
      stakeholder.userId.toString() === userId.toString()
    );
    
    return isInvitee || isStakeholder;
  }
  
  // Default: allow viewing for organization members
  return true;
};

eventSchema.methods.canEdit = function(userId, userRole) {
  // Admin can always edit
  if (userRole === 'admin') return true;
  
  // Event lead can edit
  if (this.leadUserId.toString() === userId.toString()) return true;
  
  // Department admin can edit events in their department
  if (userRole === 'dept_admin' && this.sponsorDeptId) {
    // This would need department checking logic
    return true;
  }
  
  return false;
};

eventSchema.methods.canApprove = function(userId, userRole) {
  return userRole === 'admin' || userRole === 'dept_admin';
};

module.exports = mongoose.model('Event', eventSchema);