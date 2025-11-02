const rateLimit = require('express-rate-limit');

/**
 * Cloud Import Rate Limiter
 * Limits cloud import requests to prevent abuse
 */
const cloudImportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each user to 20 cloud import requests per windowMs
  message: {
    error: 'Too many cloud import requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to limit per user
  keyGenerator: (req) => {
    return req.user ? `${req.user._id}-${req.user.organization}` : req.ip;
  },
  // Skip successful requests from counting
  skip: (req, res) => res.statusCode < 400,
});

module.exports = {
  cloudImportLimiter
};

