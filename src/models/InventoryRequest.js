const mongoose = require('mongoose');

const InventoryRequestSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  justification: {
    type: String,
    required: true
  },
  requiredDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  decisionDate: {
    type: Date
  },
  decisionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryRequest', InventoryRequestSchema); 