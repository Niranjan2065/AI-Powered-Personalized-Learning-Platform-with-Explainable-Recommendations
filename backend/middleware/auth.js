// ============================================================
// middleware/auth.js - Authentication & Authorization Middleware
// ============================================================
// protect: Verifies JWT token - must be logged in
// authorize: Checks user role - must have correct role

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * PROTECT MIDDLEWARE
 * Verifies the JWT token from Authorization header or cookie
 * Attaches user to req.user for downstream use
 *
 * Usage: router.get('/route', protect, controller)
 */
const protect = async (req, res, next) => {
  let token;

  // Check Authorization header (Bearer token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Also check cookies (for browser clients)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // No token found
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided. Please log in.',
    });
  }

  try {
    // Verify token and decode payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user in database
    // .select('-password') is default in User model, but explicit here for clarity
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token may be invalid.',
      });
    }

    // Check if user account is still active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
      });
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

/**
 * AUTHORIZE MIDDLEWARE
 * Checks if authenticated user has required role(s)
 * Must be used AFTER protect middleware
 *
 * Usage: router.get('/route', protect, authorize('admin'), controller)
 * Usage: router.get('/route', protect, authorize('tutor', 'admin'), controller)
 *
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // req.user must be set by protect middleware first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.',
      });
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route requires ${roles.join(' or ')} role. Your role is: ${req.user.role}`,
      });
    }

    next();
  };
};

/**
 * OPTIONAL AUTH MIDDLEWARE
 * Like protect but doesn't fail if no token
 * Useful for routes that work for both authenticated and guest users
 */
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
  } catch (error) {
    req.user = null;
  }

  next();
};

module.exports = { protect, authorize, optionalAuth };
