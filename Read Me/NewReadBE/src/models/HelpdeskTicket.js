const mongoose = require('mongoose');

console.log('=== HELPDESK TICKET MODEL LOADING ===');

// Ticket Comment Schema
const ticketCommentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  isInternal: {
    type: Boolean,
    default: false
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true
});

// Ticket Activity Log Schema
const ticketActivitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['created', 'assigned', 'status_changed', 'priority_changed', 'commented', 'closed', 'reopened']
  },
  details: {
    type: String,
    trim: true
  },
  oldValue: String,
  newValue: String,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Main Ticket Schema
const helpdeskTicketSchema = new mongoose.Schema({
  // Basic Information
  ticketNumber: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Classification
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpdeskCategory',
    required: true
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // People
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedRole: {
    type: String,
    enum: ['admin', 'it-team', 'hr-team', 'facilities-team', 'security-team', 'av-team', 'general-staff', 'dept_admin']
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['open', 'in_progress', 'on_hold', 'resolved', 'closed'],
    default: 'open'
  },
  
  // Timing
  dueDate: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  closedAt: {
    type: Date
  },
  firstResponseAt: {
    type: Date
  },
  
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
    }
  }],
  
  // Communication
  comments: [ticketCommentSchema],
  activityLog: [ticketActivitySchema],
  
  // Knowledge Base Integration
  suggestedArticles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeArticle'
  }],
  
  // Notifications
  notifications: {
    requesterNotified: {
      type: Boolean,
      default: false
    },
    assigneeNotified: {
      type: Boolean,
      default: false
    },
    overdueNotified: {
      type: Boolean,
      default: false
    }
  },
  
  // Tags
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Satisfaction
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    submittedAt: {
      type: Date
    }
  },
  
  // Metadata
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
helpdeskTicketSchema.index({ organization: 1, status: 1 });
helpdeskTicketSchema.index({ organization: 1, category: 1 });
helpdeskTicketSchema.index({ organization: 1, requester: 1 });
helpdeskTicketSchema.index({ organization: 1, assignedTo: 1 });
helpdeskTicketSchema.index({ organization: 1, priority: 1 });
helpdeskTicketSchema.index({ organization: 1, createdAt: -1 });
helpdeskTicketSchema.index({ dueDate: 1 });

// Virtuals
helpdeskTicketSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'closed' || this.status === 'resolved') {
    return false;
  }
  return new Date() > this.dueDate;
});

helpdeskTicketSchema.virtual('responseTime').get(function() {
  if (!this.firstResponseAt) return null;
  return this.firstResponseAt - this.createdAt;
});

helpdeskTicketSchema.virtual('resolutionTime').get(function() {
  if (!this.resolvedAt) return null;
  return this.resolvedAt - this.createdAt;
});

// Pre-save middleware
console.log('=== REGISTERING PRE-SAVE MIDDLEWARE ===');
helpdeskTicketSchema.pre('save', function(next) {
  console.log('=== TICKET PRE-SAVE MIDDLEWARE ===');
  console.log('isNew:', this.isNew);
  console.log('ticketNumber:', this.ticketNumber);
  
  // Generate ticket number if new
  if (this.isNew && !this.ticketNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    this.ticketNumber = `HD-${timestamp}-${random}`;
    console.log('Generated ticket number:', this.ticketNumber);
  }
  
  // Set due date based on priority and category rules
  if (this.isNew || this.isModified('priority') || this.isModified('category')) {
    this.populate('category').then(() => {
      if (this.category && this.category.priorityRules && this.category.priorityRules[this.priority]) {
        const responseTime = this.category.priorityRules[this.priority].responseTime;
        this.dueDate = new Date(Date.now() + (responseTime * 60 * 60 * 1000));
      }
    });
  }
  
  // Update timestamps for status changes
  if (this.isModified('status')) {
    if (this.status === 'resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
  
  next();
});

// Methods
helpdeskTicketSchema.methods.addComment = function(content, author, isInternal = false, attachments = []) {
  this.comments.push({
    content,
    author,
    isInternal,
    attachments
  });
  
  // Add to activity log
  this.activityLog.push({
    action: 'commented',
    details: isInternal ? 'Internal comment added' : 'Comment added',
    performedBy: author
  });
  
  return this.save();
};

helpdeskTicketSchema.methods.updateStatus = function(newStatus, updatedBy, details = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  this.updatedBy = updatedBy;
  
  // Add to activity log
  this.activityLog.push({
    action: 'status_changed',
    details: details || `Status changed from ${oldStatus} to ${newStatus}`,
    oldValue: oldStatus,
    newValue: newStatus,
    performedBy: updatedBy
  });
  
  return this.save();
};

helpdeskTicketSchema.methods.assignTo = function(assignee, assignedBy, details = '') {
  const oldAssignee = this.assignedTo;
  this.assignedTo = assignee;
  this.updatedBy = assignedBy;
  
  // Add to activity log
  this.activityLog.push({
    action: 'assigned',
    details: details || `Ticket assigned to ${assignee}`,
    oldValue: oldAssignee ? oldAssignee.toString() : 'Unassigned',
    newValue: assignee.toString(),
    performedBy: assignedBy
  });
  
  return this.save();
};

helpdeskTicketSchema.methods.canView = function(userId, userRole) {
  // Admin can view all tickets
  if (userRole === 'admin') return true;
  
  // Requester can view their own tickets
  if (this.requester.toString() === userId.toString()) return true;
  
  // Assignee can view assigned tickets
  if (this.assignedTo && this.assignedTo.toString() === userId.toString()) return true;
  
  // Department members can view tickets in their categories
  // This would need to be checked against the category's assigned roles
  
  return false;
};

helpdeskTicketSchema.methods.canEdit = function(userId, userRole) {
  // Admin can edit all tickets
  if (userRole === 'admin') return true;
  
  // Assignee can edit assigned tickets
  if (this.assignedTo && this.assignedTo.toString() === userId.toString()) return true;
  
  // Department members can edit tickets in their categories
  // This would need to be checked against the category's assigned roles
  
  return false;
};

// Create the model
const HelpdeskTicket = mongoose.model('HelpdeskTicket', helpdeskTicketSchema);

// Test middleware registration
console.log('=== TESTING MIDDLEWARE REGISTRATION ===');
console.log('Middleware registration completed successfully');

module.exports = HelpdeskTicket;
