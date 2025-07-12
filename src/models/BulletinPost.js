const mongoose = require('mongoose');

const bulletinPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String, // HTML or rich text
    required: true,
  },
  images: [{
    type: String, // URL or file path
  }],
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

// Add index for organization for better query performance
bulletinPostSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model('BulletinPost', bulletinPostSchema); 