const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, enum: ['leave', 'file', 'peer', 'inventory', 'payroll', 'performance', 'bulletin', 'calendar', 'attendance', 'training', 'expense', 'task'], required: true },
  link: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
});

module.exports = mongoose.model('Notification', notificationSchema); 