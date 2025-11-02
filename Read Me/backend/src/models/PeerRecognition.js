const mongoose = require('mongoose');

const peerRecognitionSchema = new mongoose.Schema({
  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recognized: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comment: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: { type: String },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, { timestamps: true });

// Add index for organization for better query performance
peerRecognitionSchema.index({ organization: 1 });

module.exports = mongoose.model('PeerRecognition', peerRecognitionSchema); 