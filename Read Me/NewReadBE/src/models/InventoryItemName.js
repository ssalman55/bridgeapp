const mongoose = require('mongoose');

const InventoryItemNameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  category: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Add compound unique index for organization-scoped item names
InventoryItemNameSchema.index({ name: 1, organization: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItemName', InventoryItemNameSchema); 