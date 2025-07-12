const jwt = require('jsonwebtoken');
const path = require('path'); // Import path module
const User = require('../models/User');
const Organization = require('../models/Organization');
const StaffProfile = require('../models/StaffProfile');
const { validateEmail, validatePassword } = require('../utils/validation');
const crypto = require('crypto');

// JWT secret key with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

/**
 * Register a new user and organization
 */
exports.register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      department,
      password,
      role = 'admin',
      organizationName
    } = req.body;

    console.log('Registration attempt:', {
      fullName,
      email,
      department,
      role,
      organizationName
    });

    // Validate required fields
    if (!email || !password || !fullName || !organizationName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Check if user already exists with this email (across all organizations)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Find or create organization
    let organization;
    try {
      // Try to find existing organization
      organization = await Organization.findOne({ name: organizationName });
      
      if (!organization) {
        // Create new organization if it doesn't exist
        const now = new Date();
        organization = new Organization({
          name: organizationName,
          email: email, // Use registering user's email
          trialStartDate: now,
          trialEndDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          plan: 'basic',
          subscriptionStatus: 'trial',
          staffLimit: 10
        });
        await organization.save();
        console.log('Created new organization:', organization._id);
      } else {
        console.log('Found existing organization:', organization._id);
      }
    } catch (orgError) {
      console.error('Organization error:', orgError);
      return res.status(400).json({
        success: false,
        message: 'Error processing organization',
        error: orgError.code === 11000 ? 'Organization name already exists' : orgError.message
      });
    }

    // Create new user with organization
    const user = new User({
      fullName,
      email,
      password, // Will be hashed by pre-save middleware
      department: department || 'Administration', // Default department for admin
      role,
      organization: organization._id
    });

    await user.save();
    console.log('User created successfully:', user._id);

    // Create staff profile
    const staffProfile = new StaffProfile({
      staffId: user._id,
      organization: organization._id,
      isComplete: false
    });
    await staffProfile.save();
    console.log('Staff profile created successfully:', staffProfile._id);

    // Send welcome email (onboarding)
    try {
      const { sendWelcomeEmail } = require('../utils/welcomeEmail');
      await sendWelcomeEmail({
        organization,
        admin: user,
        plan: organization.plan,
        trialStartDate: organization.trialStartDate,
        trialEndDate: organization.trialEndDate
      });
      console.log('Welcome email sent to', user.email);
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        organizationId: organization._id,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          department: user.department,
          role: user.role,
        },
        organization: {
          _id: organization._id,
          name: organization.name
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific error cases
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    // Validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred during registration',
      error: error.message
    });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', {
      email,
      passwordLength: password ? password.length : 0,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!email || !password) {
      console.log('Missing required fields:', { email: !!email, password: !!password });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      console.log('Invalid email format:', email);
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Find all users with this email (could be multiple due to different organizations)
    const users = await User.find({ email })
      .select('+password')
      .populate({
        path: 'organization',
        select: '_id name'
      });

    console.log('Users found:', {
      email,
      count: users.length,
      userIds: users.map(u => u._id),
      organizations: users.map(u => u.organization?._id)
    });

    if (!users || users.length === 0) {
      console.log('No users found for email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Try to find a user with matching password
    let validUser = null;
    for (const user of users) {
      console.log('Attempting password match for user:', {
        userId: user._id,
        email: user.email,
        organizationId: user.organization?._id,
        hasPassword: !!user.password,
        passwordLength: user.password?.length
      });

      const isPasswordValid = await user.matchPassword(password);
      
      if (isPasswordValid) {
        validUser = user;
        break;
      }
    }

    if (!validUser) {
      console.log('No user found with valid password for email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('Valid user found:', {
      id: validUser._id,
      email: validUser.email,
      role: validUser.role,
      status: validUser.status,
      hasOrganization: !!validUser.organization,
      organizationId: validUser.organization?._id
    });

    // Check if user is active
    if (validUser.status !== 'active') {
      console.log('User not active:', { status: validUser.status });
      return res.status(403).json({
        success: false,
        message: `Account is ${validUser.status}. Please contact your administrator.`
      });
    }

    // Update last login
    validUser.lastLogin = new Date();
    await validUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: validUser._id,
        organizationId: validUser.organization._id,
        role: validUser.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', email);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: validUser._id,
        email: validUser.email,
        fullName: validUser.fullName,
        role: validUser.role,
        department: validUser.department,
        profileImage: validUser.profileImage,
        organization: {
          _id: validUser.organization._id,
          name: validUser.organization.name,
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('organization')
      .select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          department: user.department
        },
        organization: {
          _id: user.organization._id,
          name: user.organization.name,
        }
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user profile',
      error: error.message
    });
  }
};

/**
 * Reset password for a user (admin only)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Only admin can reset passwords
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to reset passwords' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Set and hash new password
    user.password = newPassword;
    await user.save();

    console.log('Password reset successful for user:', email);
    res.json({ 
      success: true,
      message: 'Password reset successful' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

/**
 * Get current user information
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('organization', 'name');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          department: user.department,
          role: user.role,
          organization: user.organization
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user information',
      error: error.message
    });
  }
};

/**
 * Change user's own password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.matchPassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Set and hash new password
    user.password = newPassword;
    await user.save();

    console.log('Password changed successfully for user:', user.email);
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
}; 

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    // Send email using SendGrid
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'ssalman55@gmail.com';
    const COMPANY_NAME = 'Staff Bridge';
    const STAFF_BRIDGE_LOGO_URL = 'https://staffbridge.com/logo.png'; // Replace with actual logo URL
    const html = `
      <div style="max-width:600px;margin:auto;font-family:sans-serif;background:#f7f9fb;padding:32px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${STAFF_BRIDGE_LOGO_URL}" alt="Staff Bridge Logo" style="height:48px;margin-bottom:8px;" />
          <h1 style="color:#1C4E80;font-size:2rem;margin:0;">Reset Your Password</h1>
        </div>
        <p style="font-size:1.1rem;">Hi <b>${user.fullName || user.email}</b>,</p>
        <p>You requested a password reset for your Staff Bridge account. Click the button below to create a new password. This link will expire in 1 hour.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="display:inline-block;background:#EA6A47;color:#fff;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:1.1rem;">Reset Password</a>
        </div>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p style="font-size:0.95rem;color:#888;margin-top:32px;">Password must be at least 8 characters, include uppercase, lowercase, digit, and special character.</p>
        <hr style="margin:32px 0 16px 0;border:none;border-top:1px solid #e5e7eb;"/>
        <footer style="font-size:0.95rem;color:#888;text-align:center;">
          <p>Sent by ${COMPANY_NAME}</p>
        </footer>
      </div>
    `;
    const msg = {
      to: user.email,
      from: {
        email: SUPPORT_EMAIL,
        name: COMPANY_NAME
      },
      subject: 'Reset Your Password',
      html
    };
    try {
      await sgMail.send(msg);
      console.log(`[AUDIT] Password reset email sent to ${user.email} at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('Error sending password reset email:', err.response?.body?.errors || err);
    }
  }
  // Always respond with success
  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
};

// POST /api/auth/reset-password
exports.resetPasswordWithToken = async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) return res.status(400).json({ message: passwordValidation.message });

    const user = await User.findOne({
      resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
    });
  if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });

  user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Audit log
  console.log(`[AUDIT] Password reset for ${user.email} at ${new Date().toISOString()}`);

  res.json({ message: 'Your password has been successfully updated.' });
}; 

// Reset user password and ensure it's hashed (admin only)
exports.resetUserPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Only admin can reset passwords
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to reset passwords' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Force password update by marking it as modified
    user.password = newPassword;
    user.markModified('password');
    
    // Save user - this will trigger the pre-save middleware to hash the password
    await user.save();

    console.log('Password reset and hashed successfully for user:', email);
    res.json({ 
      success: true,
      message: 'Password has been reset and properly hashed' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// Update current user's profile
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

// Update profile image
exports.updateProfileImage = async (req, res) => {
  try {
    console.log('[updateProfileImage] Reached controller.');
    console.log('[updateProfileImage] req.user object:', JSON.stringify(req.user, null, 2));

    if (!req.file) {
      console.log('[updateProfileImage] Error: No file uploaded.');
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    console.log('[updateProfileImage] File received:', req.file.filename);

    // Reverting to req.user._id and checking for its existence.
    const userId = req.user?._id; 
    if (!userId) {
        console.log('[updateProfileImage] Error: User ID not found in request token.');
        return res.status(401).json({ message: 'Unauthorized: Invalid user token.' });
    }
    console.log(`[updateProfileImage] Attempting to find user with ID: ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      console.log(`[updateProfileImage] Error: User not found in database with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found.' });
    }
    
    console.log(`[updateProfileImage] User found: ${user.email}`);

    // Construct the URL using the new, unique path
    const profileImage = `/uploads/${req.file.filename}`;
    
    console.log('[updateProfileImage] Setting profile image path:', profileImage);

    user.profileImage = profileImage;
    await user.save();

    // Construct the full URL for the client to use immediately
    const fullImageUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}${profileImage}`;

    console.log('[updateProfileImage] User updated successfully:', {
      userId: user._id,
      profileImage: user.profileImage,
      fullImageUrl: fullImageUrl
    });

    res.json({
      message: 'Profile image updated successfully',
      profileImage: user.profileImage,
      fullImageUrl
    });
  } catch (error) {
    console.error('[updateProfileImage] CATCH BLOCK: An unexpected error occurred:', error);
    res.status(500).json({ message: 'Error updating profile image', error: error.message });
  }
}; 