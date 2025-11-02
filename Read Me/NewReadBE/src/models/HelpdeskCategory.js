const mongoose = require('mongoose');

const helpdeskCategorySchema = new mongoose.Schema({
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
  icon: {
    type: String,
    default: 'FiHelpCircle'
  },
  color: {
    type: String,
    default: '#1C4E80'
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Subcategories
  subcategories: [{
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
    }
  }],
  
  // Role Assignment
  assignedRoles: [{
    type: String,
    enum: ['admin', 'it-team', 'hr-team', 'facilities-team', 'security-team', 'av-team', 'general-staff', 'dept_admin']
  }],
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Auto-assignment
  autoAssignToRole: {
    type: String,
    enum: ['admin', 'it-team', 'hr-team', 'facilities-team', 'security-team', 'av-team', 'general-staff', 'dept_admin']
  },
  autoAssignToUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Priority Settings
  defaultPriority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  priorityRules: {
    low: {
      responseTime: { type: Number, default: 72 }, // hours
      description: { type: String, default: 'Standard priority - respond within 72 hours' }
    },
    medium: {
      responseTime: { type: Number, default: 24 }, // hours
      description: { type: String, default: 'Normal priority - respond within 24 hours' }
    },
    high: {
      responseTime: { type: Number, default: 8 }, // hours
      description: { type: String, default: 'High priority - respond within 8 hours' }
    },
    urgent: {
      responseTime: { type: Number, default: 2 }, // hours
      description: { type: String, default: 'Urgent - respond within 2 hours' }
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
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
helpdeskCategorySchema.index({ organization: 1, isActive: 1 });
helpdeskCategorySchema.index({ organization: 1, assignedRoles: 1 });
helpdeskCategorySchema.index({ organization: 1, assignedUsers: 1 });

// Virtual for ticket count
helpdeskCategorySchema.virtual('ticketCount', {
  ref: 'HelpdeskTicket',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Methods
helpdeskCategorySchema.methods.canAccess = function(userId, userRole) {
  // Admin can access all categories
  if (userRole === 'admin') return true;
  
  // Check if user is specifically assigned
  if (this.assignedUsers.includes(userId)) return true;
  
  // Check if user's role is assigned
  if (this.assignedRoles.includes(userRole)) return true;
  
  return false;
};

helpdeskCategorySchema.methods.getAutoAssignee = function() {
  if (this.autoAssignToUser) {
    return { type: 'user', id: this.autoAssignToUser };
  } else if (this.autoAssignToRole) {
    return { type: 'role', role: this.autoAssignToRole };
  }
  return null;
};

module.exports = mongoose.model('HelpdeskCategory', helpdeskCategorySchema);


































