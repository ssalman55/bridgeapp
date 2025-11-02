const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: false
  },
  password: {
    type: String,
    required: function() {
      return !this.ssoOnly && this.isActive; // Password not required for SSO-only users or inactive users (during onboarding)
    }
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  role: {
    type: String,
    default: 'staff'
  },
  department: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active'
  },
  archivedAt: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date
  },
  // Password reset fields
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  profileImage: {
    type: String
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  // SSO-related fields
  ssoOnly: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  name: {
    type: String
  },
  // Extended fields for official letters
  address: {
    type: String,
    trim: true,
    maxlength: 500
  },
  city: {
    type: String,
    trim: true,
    maxlength: 100
  },
  country: {
    type: String,
    trim: true,
    maxlength: 100
  },
  passportNumber: {
    type: String,
    trim: true,
    maxlength: 50
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Intern', 'Consultant'],
    default: 'Full-time'
  },
  branch: {
    type: String,
    trim: true,
    maxlength: 100
  },
  // National ID fields for WPS compliance
  nationalId: {
    qid: { type: String, trim: true }, // Qatar ID
    emiratesId: { type: String, trim: true }, // UAE Emirates ID
    iqama: { type: String, trim: true }, // Saudi Arabia Iqama
    civilId: { type: String, trim: true }, // Kuwait Civil ID
    cpr: { type: String, trim: true }, // Bahrain CPR
    nationalId: { type: String, trim: true } // Oman National ID
  },
  // Employment details for WPS
  employmentDetails: {
    hireDate: { type: Date },
    terminationDate: { type: Date },
    employmentStatus: {
      type: String,
      enum: ['active', 'terminated', 'on-leave', 'suspended'],
      default: 'active'
    },
    contractType: {
      type: String,
      enum: ['permanent', 'contract', 'temporary', 'intern'],
      default: 'permanent'
    }
  }
}, {
  timestamps: true
});

// Add compound index for email and organization for uniqueness within organization
userSchema.index({ email: 1, organization: 1 }, { unique: true });

// Add index for organization for better query performance
userSchema.index({ organization: 1 });

// Method to activate user and set password (for onboarding completion)
userSchema.methods.activateWithPassword = async function(newPassword) {
  this.password = newPassword;
  this.isActive = true;
  this.isEmailVerified = true;
  return this.save();
};

// Method to check if password matches
userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    console.log('Password comparison debug:', {
      email: this.email,
      enteredPassword: enteredPassword,
      enteredPasswordLength: enteredPassword.length,
      storedPasswordLength: this.password.length,
      storedPasswordPrefix: this.password.substring(0, 10) + '...',
      isStoredPasswordHashed: this.password.startsWith('$2')
    });
    
    const result = await bcrypt.compare(enteredPassword, this.password);
    console.log('Password comparison result:', {
      email: this.email,
      result: result,
      bcryptVersion: this.password.substring(0, 4)
    });
    return result;
  } catch (error) {
    console.error('Password comparison error:', {
      error: error.message,
      email: this.email,
      stack: error.stack
    });
    return false;
  }
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }
    console.log('Hashing new password');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('Password hashed successfully');
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    next(error);
  }
});

// Compound unique index: email should be unique within each organization
// Note: This index is already defined above at line 86, so this duplicate is removed

const User = mongoose.model('User', userSchema);

module.exports = User; 