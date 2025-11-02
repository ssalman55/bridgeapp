const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'staff'], required: true },
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
  replies: [this], // recursive for threading
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }], // evidence attachments
}, { _id: false });

const smartGoalSchema = new mongoose.Schema({
  specific: { type: String, required: true },
  specificReflection: { type: String },
  specificDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  measurable: { type: String, required: true },
  measurableReflection: { type: String },
  measurableDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  achievable: { type: String, required: true },
  achievableReflection: { type: String },
  achievableDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  relevant: { type: String, required: true },
  relevantReflection: { type: String },
  relevantDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  timeBound: { type: String, required: true },
  timeBoundReflection: { type: String },
  timeBoundDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  status: { type: String, enum: ['pending', 'in progress', 'achieved', 'not achieved'], default: 'pending' },
  result: { type: String },
}, { _id: false });

const staffCommentSchema = new mongoose.Schema({
  comment: { type: String, required: true },
  date: { type: Date, default: Date.now },
}, { _id: false });

const performanceEvaluationSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  goals: [smartGoalSchema],
  initialFeedback: { type: String },
  midyearFeedback: { type: String },
  yearendFeedback: { type: String },
  feedback: { type: String },
  staffComments: [staffCommentSchema],
  evaluationDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
}, { timestamps: true });

// Add indexes for better query performance
performanceEvaluationSchema.index({ organization: 1, staff: 1 });
performanceEvaluationSchema.index({ organization: 1, evaluator: 1 });
performanceEvaluationSchema.index({ organization: 1, status: 1 });

module.exports = mongoose.model('PerformanceEvaluation', performanceEvaluationSchema); 