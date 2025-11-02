const mongoose = require('mongoose');

const PaymentGatewayConfigSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gateway: {
    type: String,
    enum: ['stripe', 'cybersource', 'paypal', 'square', 'razorpay', 'manual'],
    required: true
  },
  config: { type: mongoose.Schema.Types.Mixed, required: true }, // Store keys/values per gateway
  encryptedFields: [String], // Track which fields are encrypted
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('PaymentGatewayConfig', PaymentGatewayConfigSchema); 