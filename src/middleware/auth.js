const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT secret key with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    console.log('[Auth] Incoming token:', token);

    if (!token) {
      console.log('[Auth] No token provided');
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[Auth] Decoded JWT:', decoded);
    
    const user = await User.findById(decoded.userId || decoded._id || decoded.id)
      .populate('organization')
      .select('-password');
    console.log('[Auth] User found:', user ? user._id : null, 'Org:', user?.organization?._id);

    if (!user) {
      console.log('[Auth] User not found');
      return res.status(401).json({ message: 'User not found' });
    }

    // Verify organization context
    if (!user.organization || (decoded.organizationId && user.organization._id.toString() !== decoded.organizationId.toString())) {
      console.log('[Auth] Organization mismatch:', {
        userOrg: user.organization?._id,
        tokenOrg: decoded.organizationId
      });
      return res.status(401).json({ message: 'Invalid organization context' });
    }

    // Add user and organization info to request object
    req.user = user;
    req.organization = user.organization;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to authorize admin access within their organization
const authorizeAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Ensure admin can only access their organization's data
    if (!req.organization || !req.user.organization || 
        req.organization._id.toString() !== req.user.organization._id.toString()) {
      return res.status(403).json({ message: 'Access denied. Invalid organization context.' });
    }

    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(500).json({ message: 'Authorization error occurred.' });
  }
};

module.exports = {
  authenticateToken,
  authorizeAdmin
}; 