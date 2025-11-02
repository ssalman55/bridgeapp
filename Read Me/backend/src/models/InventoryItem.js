const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: true,
    unique: true
  },
  serialNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  minimumThreshold: {
    type: Number,
    required: true,
    default: 0
  },
  unitCost: {
    type: Number,
    required: true,
    default: 0
  },
  totalValue: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock', 'assigned'],
    default: 'In Stock'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedDate: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add compound indexes for organization scoping
InventoryItemSchema.index({ organization: 1, status: 1 });
InventoryItemSchema.index({ organization: 1, assignedTo: 1 });
InventoryItemSchema.index({ serialNumber: 1, organization: 1 }, { unique: true });

// Calculate totalValue and status before save
InventoryItemSchema.pre('save', function(next) {
  this.totalValue = this.quantity * this.unitCost;
  this.lastUpdated = new Date();
  // Only auto-set status if not assigned
  if (this.status !== 'assigned') {
    if (this.quantity === 0) {
      this.status = 'Out of Stock';
    } else if (this.quantity <= this.minimumThreshold) {
      this.status = 'Low Stock';
    } else {
      this.status = 'In Stock';
    }
  }
  next();
});

module.exports = mongoose.model('InventoryItem', InventoryItemSchema); 