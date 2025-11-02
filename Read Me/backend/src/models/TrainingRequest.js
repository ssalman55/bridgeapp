const mongoose = require('mongoose');

const CostBreakdownSchema = new mongoose.Schema({
  registrationFee: { type: Number, default: 0 },
  travelCost: { type: Number, default: 0 },
  accommodationCost: { type: Number, default: 0 },
  mealCost: { type: Number, default: 0 },
  otherCost: { type: Number, default: 0 },
  otherCostDescription: { type: String, default: '' },
}, { _id: false });

const TrainingRequestSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trainingTitle: { type: String, required: true },
  hostedBy: { type: String, required: true },
  location: { type: String, required: true },
  numberOfDays: { type: Number, required: true },
  costBreakdown: { type: CostBreakdownSchema, required: true },
  justification: { type: String, required: true },
  expectedOutcomes: { type: String, required: true },
  benefitToOrg: { type: String, required: true },
  coverRequirements: { type: String, required: true },
  additionalNotes: { type: String },
  attachment: {
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    url: String
  },
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
  adminComment: { type: String },
  requestedDate: { type: Date, default: Date.now },
  decisionDate: { type: Date },
  approvedRejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currency: { type: String, required: true, default: 'QAR' },
}, { timestamps: true });

module.exports = mongoose.model('TrainingRequest', TrainingRequestSchema);
TrainingRequestSchema.index({ organization: 1 }); 