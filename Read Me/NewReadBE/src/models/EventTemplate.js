const mongoose = require('mongoose');

// Template Task Schema
const templateTaskSchema = new mongoose.Schema({
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
  assignedRole: {
    type: String,
    enum: ['it-team', 'facilities-team', 'catering-team', 'security-team', 'av-team', 'general-staff']
  },
  dueDateOffset: {
    type: Number, // Days before event start
    default: 1
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  conditionalOn: {
    type: String, // Which toggle this task depends on
    enum: ['refreshments', 'equipment', 'facilities', 'security', 'av']
  }
});

// Template Checklist Item Schema
const templateChecklistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  dueDateOffset: {
    type: Number, // Days before event start
    default: 0
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  conditionalOn: {
    type: String, // Which toggle this item depends on
    enum: ['refreshments', 'equipment', 'facilities', 'security', 'av']
  }
});

// Template Reminder Schema
const templateReminderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['email', 'in-app', 'sms'],
    default: 'email'
  },
  triggerOffset: {
    type: Number, // Hours before event start
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
  isDefault: {
    type: Boolean,
    default: true
  }
});

// Main EventTemplate Schema
const eventTemplateSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['Assembly', 'Parent Evening', 'External Visit', 'Meeting', 'Training', 'Social', 'Other'],
    default: 'Other'
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Default Configuration
  defaultToggles: {
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
  
  // Default Settings
  defaultDuration: {
    type: Number, // Minutes
    default: 60
  },
  defaultAttendanceMode: {
    type: String,
    enum: ['in-person', 'virtual', 'hybrid'],
    default: 'in-person'
  },
  
  // Template Content
  tasks: [templateTaskSchema],
  checklist: [templateChecklistItemSchema],
  reminders: [templateReminderSchema],
  
  // Default Notes
  defaultNotes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Usage Tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false // System templates cannot be deleted
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

// Indexes
eventTemplateSchema.index({ organization: 1, category: 1 });
eventTemplateSchema.index({ organization: 1, isActive: 1 });
eventTemplateSchema.index({ organization: 1, name: 1 });
eventTemplateSchema.index({ usageCount: -1 });

// Methods
eventTemplateSchema.methods.generateEventData = function(eventData) {
  const now = new Date();
  const eventStart = new Date(eventData.startsAt);
  
  // Generate tasks based on toggles
  const tasks = this.tasks
    .filter(task => {
      if (!task.conditionalOn) return true;
      return eventData.toggles && eventData.toggles[task.conditionalOn];
    })
    .map(task => ({
      title: task.title,
      description: task.description,
      area: task.area,
      assignedRole: task.assignedRole,
      dueDate: new Date(eventStart.getTime() - (task.dueDateOffset * 24 * 60 * 60 * 1000)),
      priority: task.priority,
      status: 'pending',
      notes: ''
    }));
  
  // Generate checklist items based on toggles
  const checklist = this.checklist
    .filter(item => {
      if (!item.conditionalOn) return true;
      return eventData.toggles && eventData.toggles[item.conditionalOn];
    })
    .map(item => ({
      title: item.title,
      description: item.description,
      dueDate: new Date(eventStart.getTime() - (item.dueDateOffset * 24 * 60 * 60 * 1000)),
      completed: false
    }));
  
  // Generate reminders
  const reminders = this.reminders
    .filter(reminder => reminder.isDefault)
    .map(reminder => ({
      type: reminder.type,
      triggerAt: new Date(eventStart.getTime() - (reminder.triggerOffset * 60 * 60 * 1000)),
      recipients: reminder.recipients,
      message: reminder.message,
      sent: false
    }));
  
  return {
    tasks,
    checklist,
    reminders,
    notes: this.defaultNotes || ''
  };
};

eventTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Static methods
eventTemplateSchema.statics.getByCategory = function(organizationId, category) {
  return this.find({
    organization: organizationId,
    category,
    isActive: true
  }).sort({ usageCount: -1, name: 1 });
};

eventTemplateSchema.statics.getPopular = function(organizationId, limit = 5) {
  return this.find({
    organization: organizationId,
    isActive: true
  }).sort({ usageCount: -1 }).limit(limit);
};

module.exports = mongoose.model('EventTemplate', eventTemplateSchema);





