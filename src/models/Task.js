const mongoose = require('mongoose');

const StatusNoteSchema = new mongoose.Schema({
  note: String,
  date: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  attachment: {
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    url: String
  },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  statusNotes: [StatusNoteSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
TaskSchema.index({ organization: 1 }); 