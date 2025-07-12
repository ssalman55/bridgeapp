const mongoose = require('mongoose');

const WorkExperienceSchema = new mongoose.Schema({
  companyName: String,
  designation: String,
  from: Date,
  to: Date,
  responsibilities: String
}, { _id: false });

const EducationSchema = new mongoose.Schema({
  degree: String,
  institute: String,
  year: Number,
  country: String,
  documentUrl: String // file upload reference
}, { _id: false });

const ChildSchema = new mongoose.Schema({
  name: String,
  dob: Date,
  school: String
}, { _id: false });

const StaffProfileSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  personalInfo: {
    dob: Date,
    gender: String,
    nationality: String,
    maritalStatus: String,
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  },
  workExperience: [WorkExperienceSchema],
  education: [EducationSchema],
  medicalHistory: {
    preExistingConditions: String,
    allergies: String,
    insuranceProvider: String
  },
  children: [ChildSchema],
  additionalInfo: {
    bankAccount: String,
    certifications: [String],
    professionalMemberships: [String]
  },
  isComplete: {
    type: Boolean,
    default: false
  },
  completionPercentage: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

StaffProfileSchema.index({ organization: 1 });

module.exports = mongoose.model('StaffProfile', StaffProfileSchema); 