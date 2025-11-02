const mongoose = require('mongoose');

const InventoryItemNameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
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

module.exports = mongoose.model('InventoryItemName', InventoryItemNameSchema); 