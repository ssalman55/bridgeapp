const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const { validateEmail } = require('../utils/validation');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// POST /api/mobile/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('[Mobile Auth] Login attempt:', { 
    email, 
    hasPassword: !!password, 
    passwordLength: password?.length,
    timestamp: new Date().toISOString()
  });
  
  if (!email || !password) {
    console.log('[Mobile Auth] Missing email or password');
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  // Validate email format
  if (!validateEmail(email)) {
    console.log('[Mobile Auth] Invalid email format:', email);
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  try {
    // Find all users with this email (could be multiple due to different organizations)
    const users = await User.find({ email: email.toLowerCase() })
      .select('+password')
      .populate({
        path: 'organization',
        select: '_id name'
      });
    
    console.log('[Mobile Auth] Users found:', {
      email: email.toLowerCase(),
      count: users.length,
      userIds: users.map(u => u._id)
    });

    if (!users || users.length === 0) {
      console.log('[Mobile Auth] User not found for email:', email.toLowerCase());
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Try to find a user with matching password
    let validUser = null;
    for (const user of users) {
      console.log('[Mobile Auth] Attempting password match for user:', {
        userId: user._id,
        email: user.email,
        organizationId: user.organization?._id
      });

      const isPasswordValid = await user.matchPassword(password);
      
      if (isPasswordValid) {
        validUser = user;
        break;
      }
    }

    if (!validUser) {
      console.log('[Mobile Auth] Password mismatch for all users');
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    
    console.log('[Mobile Auth] User found:', {
      userId: validUser._id,
      email: validUser.email,
      hasPassword: !!validUser.password,
      status: validUser.status
    });

    // Check if user is active
    if (validUser.status !== 'active') {
      console.log('[Mobile Auth] User not active:', { status: validUser.status });
      return res.status(403).json({
        success: false,
        message: `Account is ${validUser.status}. Please contact your administrator.`
      });
    }

    // Check subscription status and suspension
    if (validUser.organization && validUser.organization._id) {
      const organization = await Organization.findById(validUser.organization._id);
      if (organization) {
        // Check if organization is suspended
        if (organization.isSuspended) {
          console.log(`[Mobile Auth] Organization ${organization.name} is suspended`);
          return res.status(403).json({
            success: false,
            message: 'Your organization subscription has been paused. Please contact support for assistance.',
            code: 'ORGANIZATION_SUSPENDED'
          });
        }

        // Check subscription expiration
        const now = new Date();
        let isExpired = false;
        
        if (organization.subscriptionStatus === 'trial' && organization.trialEndDate && now > organization.trialEndDate) {
          isExpired = true;
        } else if (organization.subscriptionStatus === 'active' && organization.subscriptionEndDate && now > organization.subscriptionEndDate) {
          isExpired = true;
        } else if (organization.subscriptionStatus === 'expired') {
          isExpired = true;
        }

        // Note: We allow login even if expired, but mobile app should handle this appropriately
        if (isExpired && validUser.email !== 'admin@sb.com') {
          console.log('[Mobile Auth] User with expired subscription logging in:', email);
        }
      }
    }

    // Update last login
    validUser.lastLogin = new Date();
    await validUser.save();

    // Generate JWT token (matching web format)
    const token = jwt.sign(
      { 
        userId: validUser._id, 
        email: validUser.email, 
        role: validUser.role,
        organization: validUser.organization?._id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('[Mobile Auth] Password match successful for user:', validUser._id);
    
    // Return mobile-optimized response
    res.json({
      success: true,
      token,
      user: {
        id: validUser._id.toString(), // Use 'id' for mobile compatibility
        _id: validUser._id.toString(), // Also include _id
        fullName: validUser.fullName,
        email: validUser.email,
        role: validUser.role,
        department: validUser.department,
        profileImage: validUser.profileImage,
        organization: validUser.organization ? {
          _id: validUser.organization._id.toString(),
          name: validUser.organization.name
        } : undefined,
        // Include additional fields that mobile might need
        firstName: validUser.firstName,
        lastName: validUser.lastName
      }
    });
  } catch (err) {
    console.error('[Mobile Auth] Server error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

