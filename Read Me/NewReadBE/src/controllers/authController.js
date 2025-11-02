const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path'); // Import path module
const User = require('../models/User');
const Organization = require('../models/Organization');
const StaffProfile = require('../models/StaffProfile');
const { validateEmail, validatePassword, validatePhone } = require('../utils/validation');
const { admin } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
// const { sendForgotPasswordEmail } = require('../utils/welcomeEmail'); // Commented out SendGrid implementation
const { sendForgotPasswordEmail } = require('../services/emailService'); // New SMTP implementation
const { uploadFile, getProfileImageUrl, deleteFile, getSignedUrl } = require('../utils/s3');

// JWT secret key with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Define the UPLOAD_DIR consistent with other files
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

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
      organizationName,
      plan = 'basic'
    } = req.body;

    // Validate plan
    const validPlans = ['basic', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    console.log('Registration attempt:', {
      fullName,
      email,
      department,
      role,
      organizationName,
      plan
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
        
        // Set staff limit based on plan
        let staffLimit = 10;
        if (plan === 'professional') staffLimit = 100;
        if (plan === 'enterprise') staffLimit = 1000000; // Effectively unlimited
        
        organization = new Organization({
          name: organizationName,
          email: email, // Use registering user's email
          trialStartDate: now,
          trialEndDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          plan: plan,
          subscriptionStatus: 'trial',
          staffLimit: staffLimit
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

    // Check if this is the first admin user in the organization
    const existingAdminUsers = await User.countDocuments({ 
      organization: organization._id, 
      role: 'admin' 
    });
    
    // Create new user with organization
    const user = new User({
      fullName,
      email,
      password, // Will be hashed by pre-save middleware
      department: department || 'Administration', // Default department for admin
      role,
      organization: organization._id,
      isSuperAdmin: existingAdminUsers === 0 && role === 'admin' // First admin becomes super admin
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

    // Create default roles for the organization
    try {
      const { createDefaultRoles } = require('./roleController');
      await createDefaultRoles(organization._id);
      console.log('Default roles created for organization:', organization._id);
    } catch (roleError) {
      console.error('Error creating default roles:', roleError);
      // Don't fail the entire operation if role creation fails
    }

    // Send welcome email (onboarding)
    try {
      // const { sendWelcomeEmail } = require('../utils/welcomeEmail'); // Commented out SendGrid implementation
      const { sendWelcomeEmail } = require('../services/emailService'); // New SMTP implementation
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

    // Check subscription status and suspension before allowing login
    if (validUser.organization) {
      const organization = await Organization.findById(validUser.organization._id);
      if (organization) {
        // FIRST: Check if organization is suspended (this should block login immediately)
        if (organization.isSuspended) {
          console.log(`Login blocked - Organization ${organization.name} (${organization._id}) is suspended. Reason: ${organization.suspensionReason || 'No reason provided'}`);
          return res.status(403).json({
            success: false,
            message: 'Your organization subscription has been paused. Please contact support for assistance.',
            code: 'ORGANIZATION_SUSPENDED',
            requiresTokenCleanup: true
          });
        }

        const now = new Date();
        let isExpired = false;
        let statusChanged = false;

        // Check if trial has expired
        if (organization.subscriptionStatus === 'trial' && organization.trialEndDate && now > organization.trialEndDate) {
          isExpired = true;
          if (organization.subscriptionStatus !== 'expired') {
            organization.subscriptionStatus = 'expired';
            statusChanged = true;
          }
        }
        // Check if subscription has expired
        else if (organization.subscriptionStatus === 'active' && organization.subscriptionEndDate && now > organization.subscriptionEndDate) {
          isExpired = true;
          if (organization.subscriptionStatus !== 'expired') {
            organization.subscriptionStatus = 'expired';
            statusChanged = true;
          }
        }
        // Check if already expired
        else if (organization.subscriptionStatus === 'expired') {
          isExpired = true;
        }

        // Update database if status changed
        if (statusChanged) {
          await organization.save();
          console.log(`Updated organization ${organization.name} (${organization._id}) subscription status to: expired`);
        }

        // Allow login but include subscription status information
        if (isExpired && validUser.email !== 'admin@sb.com') {
          console.log('User with expired subscription logging in:', email);
          // Don't block login, just include subscription status
        }
      }
    }

    // Update last login
    validUser.lastLogin = new Date();
    await validUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: validUser._id, 
        email: validUser.email, 
        role: validUser.role,
        organization: validUser.organization 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Include subscription status in response
    let subscriptionInfo = null;
    if (validUser.organization) {
      const organization = await Organization.findById(validUser.organization._id);
      if (organization) {
        const now = new Date();
        let isExpired = false;
        
        if (organization.subscriptionStatus === 'trial' && organization.trialEndDate && now > organization.trialEndDate) {
          isExpired = true;
        } else if (organization.subscriptionStatus === 'active' && organization.subscriptionEndDate && now > organization.subscriptionEndDate) {
          isExpired = true;
        } else if (organization.subscriptionStatus === 'expired') {
          isExpired = true;
        }

        subscriptionInfo = {
          status: organization.subscriptionStatus,
          isExpired,
          trialEndDate: organization.trialEndDate,
          subscriptionEndDate: organization.subscriptionEndDate,
          plan: organization.plan
        };
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: validUser._id,
        email: validUser.email,
        fullName: validUser.fullName,
        role: validUser.role,
        organization: validUser.organization,
        profileImage: validUser.profileImage,
        lastLogin: validUser.lastLogin
      },
      subscriptionInfo
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

    // Check if organization is suspended (this should block access immediately)
    if (user.organization && user.organization._id) {
      const organization = await Organization.findById(user.organization._id);
      if (organization && organization.isSuspended) {
        console.log(`Access blocked - Organization ${organization.name} (${organization._id}) is suspended. Reason: ${organization.suspensionReason || 'No reason provided'}`);
        return res.status(403).json({
          success: false,
          message: 'Your organization subscription has been paused. Please contact support for assistance.',
          code: 'ORGANIZATION_SUSPENDED',
          requiresTokenCleanup: true
        });
      }
    }

    // Generate signed URL for profile image if it exists
    let profileImageUrl = null;
    if (user.profileImage) {
      try {
        profileImageUrl = getSignedUrl(user.profileImage, 3600); // 1 hour expiration
      } catch (error) {
        console.warn('Could not generate signed URL for profile image:', error.message);
        profileImageUrl = null;
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          department: user.department,
          profileImage: profileImageUrl // Return signed URL instead of S3 key
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
      .populate('organization', 'name _id');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if organization is suspended (this should block access immediately)
    if (user.organization && user.organization._id) {
      const organization = await Organization.findById(user.organization._id);
      if (organization && organization.isSuspended) {
        console.log(`Access blocked - Organization ${organization.name} (${organization._id}) is suspended. Reason: ${organization.suspensionReason || 'No reason provided'}`);
        return res.status(403).json({
          success: false,
          message: 'Your organization subscription has been paused. Please contact support for assistance.',
          code: 'ORGANIZATION_SUSPENDED',
          requiresTokenCleanup: true
        });
      }
    }

    // Generate signed URL for profile image if it exists
    let profileImageUrl = null;
    if (user.profileImage) {
      try {
        profileImageUrl = getSignedUrl(user.profileImage, 3600); // 1 hour expiration
      } catch (error) {
        console.warn('Could not generate signed URL for profile image:', error.message);
        profileImageUrl = null;
      }
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
          organization: user.organization,
          profileImage: profileImageUrl, // Return signed URL instead of S3 key
          isSuperAdmin: user.isSuperAdmin
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
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();
      const baseUrl = (process.env.LIVE_FRONTEND_URL || process.env.FRONTEND_URL || 'https://www.stfbridge.com').replace(/\/$/, '');
      const resetLink = `${baseUrl}/reset-password/${token}`;
      await sendForgotPasswordEmail({
        to: user.email,
        fullName: user.fullName,
        resetLink
      });
    }
    res.json({ message: 'If the email is valid, a password reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'If the email is valid, a password reset link has been sent.' });
  }
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

// Admin: Update user information
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, department } = req.body;
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only admins can update users.' });
    }
    
    // Find the user
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user belongs to the same organization
    if (user.organization.toString() !== req.user.organization.toString()) {
      return res.status(403).json({ message: 'Access denied. Cannot update users from other organizations.' });
    }
    
    // Update user fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (role) user.role = role;
    if (department) user.department = department;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user', error: error.message });
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
    
    console.log('[updateProfileImage] File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'Only image files are allowed for profile pictures.' });
    }

    // Validate file size (max 5MB for profile images)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ message: 'Profile image size must be less than 5MB.' });
    }

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

    // If user already has a profile image, delete the old one from S3
    if (user.profileImage && user.profileImage.includes('amazonaws.com')) {
      try {
        // Extract S3 key from the URL
        const s3Key = user.profileImage.split('amazonaws.com/')[1];
        if (s3Key) {
          console.log('[updateProfileImage] Deleting old profile image from S3:', s3Key);
          await deleteFile(s3Key);
          console.log('[updateProfileImage] Old profile image deleted successfully');
        }
      } catch (deleteError) {
        console.warn('[updateProfileImage] Warning: Could not delete old profile image:', deleteError.message);
        // Continue with upload even if deletion fails
      }
    }

    // Generate unique S3 key for the new profile image
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    const s3Key = `profile-images/${user.organization}/${userId}-${timestamp}.${fileExtension}`;
    
    console.log('[updateProfileImage] Uploading to S3 with key:', s3Key);

    // Upload to S3
    const s3Result = await uploadFile(req.file, s3Key);
    console.log('[updateProfileImage] S3 upload successful:', s3Result.Location);

    // Store the S3 key instead of the full URL for signed URL generation
    console.log('[updateProfileImage] Setting profile image S3 key:', s3Key);

    // Update user with S3 key (not full URL)
    user.profileImage = s3Key;
    await user.save();

    console.log('[updateProfileImage] User updated successfully:', {
      userId: user._id,
      profileImage: user.profileImage,
      s3Key: s3Key
    });

    // Generate a signed URL for the response
    const signedUrl = getProfileImageUrl(s3Key);
    
    res.json({
      message: 'Profile image updated successfully',
      profileImage: user.profileImage, // This is now the S3 key
      fullImageUrl: signedUrl // This is the signed URL
    });
  } catch (error) {
    console.error('[updateProfileImage] CATCH BLOCK: An unexpected error occurred:', error);
    res.status(500).json({ message: 'Error updating profile image', error: error.message });
  }
};

// Get signed URL for profile image
exports.getProfileImageUrl = async (req, res) => {
  try {
    const { s3Key } = req.params;
    
    if (!s3Key) {
      return res.status(400).json({ message: 'S3 key is required' });
    }

    // Decode the S3 key
    const decodedS3Key = decodeURIComponent(s3Key);
    
    // Generate signed URL with 1 hour expiration
    const signedUrl = getSignedUrl(decodedS3Key, 3600);
    
    res.json({ 
      signedUrl,
      expiresIn: 3600 
    });
  } catch (error) {
    console.error('Error generating profile image URL:', error);
    res.status(500).json({ message: 'Error generating image URL' });
  }
};

// Upload banner image (Admin only)
exports.uploadBannerImage = async (req, res) => {
  try {
    console.log('[uploadBannerImage] Starting banner image upload');
    console.log('[uploadBannerImage] req.user object:', JSON.stringify(req.user, null, 2));

    if (!req.file) {
      console.log('[uploadBannerImage] Error: No file uploaded.');
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    console.log('[uploadBannerImage] File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'Only image files are allowed for banner images.' });
    }

    // Validate file size (max 5MB for banner images)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ message: 'Banner image size must be less than 5MB.' });
    }

    const organizationId = req.user?.organization;
    if (!organizationId) {
      console.log('[uploadBannerImage] Error: Organization ID not found in request token.');
      return res.status(401).json({ message: 'Unauthorized: Invalid organization token.' });
    }
    
    // Fetch user from database to get the organization ID properly
    const userId = req.user?._id;
    if (!userId) {
      console.log('[uploadBannerImage] Error: User ID not found in request token.');
      return res.status(401).json({ message: 'Unauthorized: Invalid user token.' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      console.log(`[uploadBannerImage] Error: User not found in database with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Use the organization ID from the database user object
    const orgId = user.organization.toString();
    console.log(`[uploadBannerImage] Organization ID: ${orgId}`);

    // Generate unique S3 key for the banner image
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    // Use a shorter key format to avoid S3 key length limits (max 1024 chars)
    const s3Key = `banner-images/${orgId}/banner-${timestamp}.${fileExtension}`;
    
    // Validate S3 key length (S3 limit is 1024 characters)
    if (s3Key.length > 1024) {
      console.log('[uploadBannerImage] Error: S3 key too long:', s3Key.length);
      return res.status(400).json({ message: 'Generated S3 key is too long. Please try with a shorter filename.' });
    }
    
    console.log('[uploadBannerImage] Uploading to S3 with key:', s3Key);

    // Upload to S3
    const s3Result = await uploadFile(req.file, s3Key);
    console.log('[uploadBannerImage] S3 upload successful:', s3Result.Location);

    // Generate a signed URL for the response
    const signedUrl = getProfileImageUrl(s3Key);
    
    res.json({
      message: 'Banner image uploaded successfully',
      s3Key: s3Key,
      url: signedUrl,
      fullImageUrl: signedUrl
    });
  } catch (error) {
    console.error('[uploadBannerImage] CATCH BLOCK: An unexpected error occurred:', error);
    res.status(500).json({ message: 'Error uploading banner image', error: error.message });
  }
};

// Get signed URL for banner image
exports.getBannerImageUrl = async (req, res) => {
  try {
    const { s3Key } = req.params;
    
    if (!s3Key) {
      return res.status(400).json({ message: 'S3 key is required' });
    }

    // Decode the S3 key
    const decodedS3Key = decodeURIComponent(s3Key);
    
    // Generate signed URL with 1 hour expiration
    const signedUrl = getSignedUrl(decodedS3Key, 3600);
    
    res.json({ 
      signedUrl,
      expiresIn: 3600 
    });
  } catch (error) {
    console.error('Error generating banner image URL:', error);
    res.status(500).json({ message: 'Error generating banner image URL' });
  }
};

// Get signed URL for logo image
exports.getLogoImageUrl = async (req, res) => {
  try {
    const { s3Key } = req.params;
    
    if (!s3Key) {
      return res.status(400).json({ message: 'S3 key is required' });
    }

    // Decode the S3 key
    const decodedS3Key = decodeURIComponent(s3Key);
    
    // Generate signed URL with 1 hour expiration
    const signedUrl = getSignedUrl(decodedS3Key, 3600);
    
    res.json({ 
      signedUrl,
      expiresIn: 3600 
    });
  } catch (error) {
    console.error('Error generating logo image URL:', error);
    res.status(500).json({ message: 'Error generating logo image URL' });
  }
};

// Refresh JWT token
exports.refreshToken = async (req, res) => {
  try {
    // Get the current user from the request (already authenticated by middleware)
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user is still active
    if (user.status !== 'active') {
      return res.status(401).json({ 
        success: false, 
        message: 'User account is not active' 
      });
    }

    // Check if organization is suspended (this should block token refresh immediately)
    if (user.organization) {
      const organization = await Organization.findById(user.organization);
      if (organization && organization.isSuspended) {
        console.log(`Token refresh blocked - Organization ${organization.name} (${organization._id}) is suspended. Reason: ${organization.suspensionReason || 'No reason provided'}`);
        return res.status(403).json({
          success: false,
          message: 'Your organization subscription has been paused. Please contact support for assistance.',
          code: 'ORGANIZATION_SUSPENDED',
          requiresTokenCleanup: true
        });
      }
    }

    // Generate new token
    const newToken = jwt.sign(
      {
        userId: user._id,
        organizationId: user.organization,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        organization: user.organization,
        profileImage: user.profileImage,
        isSuperAdmin: user.isSuperAdmin
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error refreshing token' 
    });
  }
}; 