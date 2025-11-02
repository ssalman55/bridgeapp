const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['stage-change', 'task-status', 'document-signed', 'day-offset', 'overdue', 'field-value']
  },
  field: String, // For field-value conditions
  operator: {
    type: String,
    enum: ['equals', 'not-equals', 'contains', 'greater-than', 'less-than', 'before', 'after']
  },
  value: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['send-email', 'assign-task', 'create-ticket', 'provision-account', 'assign-equipment', 'enroll-training', 'escalate', 'webhook', 'update-field']
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  delayMinutes: {
    type: Number,
    default: 0
  }
}, { _id: false });

const onboardingAutomationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Trigger conditions
  trigger: {
    event: {
      type: String,
      required: true,
      enum: ['onboarding-created', 'stage-changed', 'task-completed', 'task-overdue', 'document-signed', 'cron-daily', 'cron-hourly']
    },
    conditions: [conditionSchema]
  },
  
  // Actions to execute
  actions: [actionSchema],
  
  // Execution settings
  executionSettings: {
    maxExecutions: Number, // Limit per onboarding instance
    cooldownMinutes: Number, // Minimum time between executions
    executeOnce: {
      type: Boolean,
      default: false
    }
  },
  
  // Filtering
  filters: {
    templates: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnboardingTemplate'
    }],
    departments: [String],
    roles: [String],
    locations: [String]
  },
  
  // Execution history
  executionHistory: [{
    onboardingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnboardingPipeline'
    },
    executedAt: {
      type: Date,
      default: Date.now
    },
    success: Boolean,
    error: String,
    actionsExecuted: Number,
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Statistics
  stats: {
    totalExecutions: {
      type: Number,
      default: 0
    },
    successfulExecutions: {
      type: Number,
      default: 0
    },
    lastExecutedAt: Date,
    averageExecutionTime: Number
  },
  
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
onboardingAutomationSchema.index({ organization: 1, isActive: 1 });
onboardingAutomationSchema.index({ organization: 1, 'trigger.event': 1 });
onboardingAutomationSchema.index({ 'filters.templates': 1 });

module.exports = mongoose.model('OnboardingAutomation', onboardingAutomationSchema);







