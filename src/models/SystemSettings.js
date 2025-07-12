const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
  organizationName: { type: String, required: true },
  logoUrl: { type: String }, // Can be a URL or base64 string
  currency: { type: String, default: 'QAR' },
  workdays: { type: [String], default: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
  timezone: { type: String, default: 'Asia/Qatar' },
  fiscalYearStart: { type: String }, // e.g., '2024-01'
  fiscalYearEnd: { type: String },   // e.g., '2024-12'
  defaultLanguage: { type: String, default: 'en' },
  countryOfOperation: { type: String },
  publicHolidays: { type: [String], default: [] }, // ISO date strings
  attendanceCutoffTime: { type: String }, // e.g., '08:30 AM'
  allowRetroEdits: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
});

SystemSettingsSchema.index({ organization: 1 });

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema); 