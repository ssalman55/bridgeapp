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
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: false
  },
  password: {
    type: String,
    required: true
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
  }
}, {
  timestamps: true
});

// Add compound index for email and organization for uniqueness within organization
userSchema.index({ email: 1, organization: 1 }, { unique: true });

// Add index for organization for better query performance
userSchema.index({ organization: 1 });

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

// Pre-save middleware to hash password and normalize role
userSchema.pre('save', async function(next) {
  try {
    if (this.isModified('role') && typeof this.role === 'string') {
      this.role = this.role.toLowerCase();
    }
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

const User = mongoose.model('User', userSchema);

module.exports = User; 