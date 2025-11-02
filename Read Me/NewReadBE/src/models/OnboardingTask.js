const mongoose = require('mongoose');

const onboardingTaskSchema = new mongoose.Schema({
  onboarding: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OnboardingPipeline',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  templateItemId: String,
  
  // Task details
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  taskType: {
    type: String,
    required: true,
    enum: ['form', 'document', 'e-sign', 'it-provisioning', 'equipment', 'orientation', 'manager-task', 'training', 'generic-hr', 'facilities']
  },
  category: {
    type: String,
    enum: ['preboarding', 'setup', 'compliance', 'training', 'equipment', 'documentation'],
    default: 'setup'
  },
  
  // Assignment and ownership
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedRole: {
    type: String,
    enum: ['hr', 'it', 'facilities', 'manager', 'new-hire', 'admin']
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: Date,
  
  // Status and progress
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in-progress', 'blocked', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Timing
  dueDate: {
    type: Date,
    required: true
  },
  startedAt: Date,
  completedAt: Date,
  slaHours: {
    type: Number,
    default: 24
  },
  isOverdue: {
    type: Boolean,
    default: false
  },
  
  // Dependencies
  dependencies: [{
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnboardingTask'
    },
    type: {
      type: String,
      enum: ['blocks', 'requires'],
      default: 'requires'
    }
  }],
  dependencyStatus: {
    type: String,
    enum: ['ready', 'waiting', 'blocked'],
    default: 'ready'
  },
  
  // Task-specific data
  formData: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed,
  
  // Files and attachments
  files: [{
    name: String,
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
  
  // Communication
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Reminders and notifications
  remindersSent: [{
    sentAt: Date,
    sentTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['due-soon', 'overdue', 'escalation']
    }
  }],
  
  // Approval workflow
  approvers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    decidedAt: Date,
    comments: String
  }],
  
  // External integrations
  externalReferences: [{
    system: String, // 'jira', 'servicenow', 'workday', etc.
    externalId: String,
    url: String,
    status: String
  }],
  
  // Audit trail
  auditLog: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    details: String
  }],
  
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
  timestamps: true
});

// Indexes
onboardingTaskSchema.index({ organization: 1, status: 1 });
onboardingTaskSchema.index({ organization: 1, assignedTo: 1, status: 1 });
onboardingTaskSchema.index({ organization: 1, dueDate: 1, status: 1 });
onboardingTaskSchema.index({ onboarding: 1, status: 1 });
onboardingTaskSchema.index({ organization: 1, taskType: 1 });
onboardingTaskSchema.index({ organization: 1, isOverdue: 1 });

// Virtual for time remaining
onboardingTaskSchema.virtual('timeRemaining').get(function() {
  if (this.status === 'completed' || this.status === 'rejected') return null;
  const now = new Date();
  const timeDiff = this.dueDate.getTime() - now.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Days remaining
});

// Method to check if task can be started
onboardingTaskSchema.methods.canBeStarted = function() {
  return this.dependencyStatus === 'ready' && this.status === 'pending';
};

// Method to update dependency status
onboardingTaskSchema.methods.updateDependencyStatus = async function() {
  if (this.dependencies.length === 0) {
    this.dependencyStatus = 'ready';
    return;
  }
  
  // Check if all dependencies are completed
  const dependencyIds = this.dependencies.map(dep => dep.taskId);
  const dependencyTasks = await this.constructor.find({
    _id: { $in: dependencyIds },
    status: { $ne: 'completed' }
  });
  
  if (dependencyTasks.length === 0) {
    this.dependencyStatus = 'ready';
  } else {
    this.dependencyStatus = 'waiting';
  }
};

module.exports = mongoose.model('OnboardingTask', onboardingTaskSchema);







