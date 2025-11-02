const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
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
  ownerRole: {
    type: String,
    required: true,
    enum: ['hr', 'it', 'facilities', 'manager', 'new-hire', 'admin']
  },
  relativeDueDate: {
    type: Number, // Days relative to start date (negative = before, positive = after)
    required: true
  },
  slaHours: {
    type: Number,
    default: 24
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  dependencies: [{
    type: String // IDs of other checklist items that must be completed first
  }],
  automationRules: [{
    trigger: {
      type: String,
      enum: ['completion', 'creation', 'overdue']
    },
    action: {
      type: String,
      enum: ['email', 'provision-account', 'assign-equipment', 'enroll-training', 'escalate']
    },
    config: mongoose.Schema.Types.Mixed // Flexible config for each action type
  }],
  metadata: mongoose.Schema.Types.Mixed, // Flexible field for task-specific data
  order: {
    type: Number,
    required: true
  }
}, { _id: false });

const onboardingTemplateSchema = new mongoose.Schema({
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
  department: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  checklistItems: [checklistItemSchema],
  documentPackages: [{
    name: String,
    documents: [{
      name: String,
      templateUrl: String,
      signerRoles: [String], // Who needs to sign
      isRequired: Boolean
    }]
  }],
  equipmentKits: [{
    name: String,
    items: [{
      itemId: String,
      itemName: String,
      category: String,
      isRequired: Boolean
    }]
  }],
  // Auto-assign settings
  defaultAssignees: {
    hr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    it: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    facilities: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
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
onboardingTemplateSchema.index({ organization: 1, name: 1 }, { unique: true });
onboardingTemplateSchema.index({ organization: 1, department: 1, role: 1, location: 1 });
onboardingTemplateSchema.index({ organization: 1, isActive: 1 });

module.exports = mongoose.model('OnboardingTemplate', onboardingTemplateSchema);







