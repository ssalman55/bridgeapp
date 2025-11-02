const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  templateItemId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  taskType: {
    type: String,
    required: true,
    enum: ['form', 'document', 'e-sign', 'it-provisioning', 'equipment', 'orientation', 'manager-task', 'training', 'generic-hr', 'facilities']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in-progress', 'blocked', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedRole: {
    type: String,
    enum: ['hr', 'it', 'facilities', 'manager', 'new-hire', 'admin']
  },
  dueDate: {
    type: Date,
    required: true
  },
  completedAt: Date,
  slaHours: {
    type: Number,
    default: 24
  },
  isOverdue: {
    type: Boolean,
    default: false
  },
  dependencies: [String], // Task IDs that must be completed first
  dependencyStatus: {
    type: String,
    enum: ['ready', 'waiting', 'blocked'],
    default: 'ready'
  },
  metadata: mongoose.Schema.Types.Mixed,
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  files: [{
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { _id: false });

const stageHistorySchema = new mongoose.Schema({
  stage: {
    type: String,
    required: true,
    enum: ['offer-accepted', 'preboarding', 'provisioning', 'ready-to-start', 'day-1', 'on-hold', 'withdrawn']
  },
  enteredAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

const onboardingPipelineSchema = new mongoose.Schema({
  newHire: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OnboardingTemplate',
    required: true
  },
  templateSnapshot: mongoose.Schema.Types.Mixed, // Snapshot of template at creation time
  
  // Basic info
  employeeId: String,
  position: String,
  department: String,
  location: String,
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  startDate: {
    type: Date,
    required: true
  },
  
  // Current status
  currentStage: {
    type: String,
    required: true,
    enum: ['offer-accepted', 'preboarding', 'provisioning', 'ready-to-start', 'day-1', 'on-hold', 'withdrawn'],
    default: 'offer-accepted'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Tasks and progress
  tasks: [taskSchema],
  completedTasksCount: {
    type: Number,
    default: 0
  },
  totalTasksCount: {
    type: Number,
    default: 0
  },
  progressPercentage: {
    type: Number,
    default: 0
  },
  
  // Preboarding portal
  preboardingToken: String,
  preboardingCompleted: {
    type: Boolean,
    default: false
  },
  preboardingCompletedAt: Date,
  
  // Equipment and access
  equipmentAssigned: [{
    itemId: String,
    itemName: String,
    assignedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['reserved', 'issued', 'returned'],
      default: 'reserved'
    }
  }],
  
  // Documents and e-signatures
  documents: [{
    name: String,
    packageName: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'signed', 'completed', 'expired'],
      default: 'pending'
    },
    signers: [{
      role: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      email: String,
      status: {
        type: String,
        enum: ['pending', 'sent', 'signed'],
        default: 'pending'
      },
      signedAt: Date
    }],
    documentUrl: String,
    signedDocumentUrl: String,
    externalId: String, // E-sign provider reference
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Stage tracking
  stageHistory: [stageHistorySchema],
  
  // Blockers and issues
  blockers: [{
    type: {
      type: String,
      enum: ['missing-info', 'approval-pending', 'system-issue', 'external-dependency', 'other']
    },
    description: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // KPI tracking
  kpis: {
    timeToReady: Number, // Days from offer accepted to ready-to-start
    timeToProductivity: Number, // Days from start to day-30 completion
    slaCompliance: Number, // Percentage of tasks completed within SLA
    firstDayReadiness: Boolean
  },
  
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
    details: mongoose.Schema.Types.Mixed
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
onboardingPipelineSchema.index({ organization: 1, currentStage: 1 });
onboardingPipelineSchema.index({ organization: 1, newHire: 1 }, { unique: true });
onboardingPipelineSchema.index({ organization: 1, startDate: 1 });
onboardingPipelineSchema.index({ organization: 1, manager: 1 });
onboardingPipelineSchema.index({ preboardingToken: 1 }, { unique: true, sparse: true });
onboardingPipelineSchema.index({ 'tasks.assignedTo': 1, 'tasks.status': 1 });
onboardingPipelineSchema.index({ 'tasks.dueDate': 1, 'tasks.status': 1 });

// Virtual for overdue tasks
onboardingPipelineSchema.virtual('overdueTasks').get(function() {
  const now = new Date();
  return this.tasks.filter(task => 
    task.status !== 'completed' && 
    task.status !== 'rejected' && 
    task.dueDate < now
  );
});

// Method to update progress
onboardingPipelineSchema.methods.updateProgress = function() {
  this.completedTasksCount = this.tasks.filter(task => task.status === 'completed').length;
  this.totalTasksCount = this.tasks.length;
  this.progressPercentage = this.totalTasksCount > 0 ? 
    Math.round((this.completedTasksCount / this.totalTasksCount) * 100) : 0;
};

// Method to check and update overdue status
onboardingPipelineSchema.methods.updateOverdueStatus = function() {
  const now = new Date();
  this.tasks.forEach(task => {
    if (task.status !== 'completed' && task.status !== 'rejected') {
      task.isOverdue = task.dueDate < now;
    }
  });
};

module.exports = mongoose.model('OnboardingPipeline', onboardingPipelineSchema);


