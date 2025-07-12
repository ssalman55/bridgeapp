const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT secret key with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Middleware to protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, no token provided' 
      });
    }

    try {
      // Use the JWT_SECRET constant
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Check for both userId and id in the token payload
      const userId = decoded.userId || decoded.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format'
        });
      }

      const user = await User.findById(userId)
        .select('-password')
        .populate('organization');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Account is ${user.status}. Please contact your administrator.`
        });
      }

      // Verify organization context if present in token
      if (decoded.organizationId && user.organization && 
          user.organization._id.toString() !== decoded.organizationId.toString()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid organization context'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Token verification error:', {
        error: error.message,
        name: error.name,
        stack: error.stack
      });

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.'
        });
      }

      res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

// Middleware to check if user is admin
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};

// Middleware to check if user is admin or academic admin
const adminOrAcademicAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'academic_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin or academic admin' });
  }
};

// Middleware to check if user is academic admin
const academicAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'academic_admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as academic admin' });
  }
};

// Middleware to check if user is inventory manager
const inventoryManager = (req, res, next) => {
  if (req.user && req.user.role === 'inventory_manager') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as inventory manager' });
  }
};

// Middleware to check if user is admin or inventory manager
const adminOrInventoryManager = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'inventory_manager')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin or inventory manager' });
  }
};

// Aliases for compatibility
const authenticateToken = protect;
const authorizeAdmin = admin;

module.exports = {
  protect,
  admin,
  adminOrAcademicAdmin,
  academicAdmin,
  inventoryManager,
  adminOrInventoryManager,
  authenticateToken,
  authorizeAdmin
}; 