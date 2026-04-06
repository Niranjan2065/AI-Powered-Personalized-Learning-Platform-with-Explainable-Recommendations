// ============================================================
// middleware/errorHandler.js - Global Error Handler
// ============================================================
// Catches all errors and returns consistent JSON error responses
// Different handling for development vs production

/**
 * Global Error Handler Middleware
 * Must be the LAST middleware registered in app
 * Catches errors passed via next(error)
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ ERROR:', err);
  }

  // ---- Mongoose Specific Errors ----

  // Mongoose bad ObjectId (e.g., invalid ID format)
  if (err.name === 'CastError') {
    const message = `Resource not found. Invalid ID: ${err.value}`;
    error = { statusCode: 404, message };
  }

  // Mongoose duplicate key error (e.g., duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate value: ${field} '${value}' already exists`;
    error = { statusCode: 400, message };
  }

  // Mongoose validation error (e.g., required field missing)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    const message = messages.join('. ');
    error = { statusCode: 400, message };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { statusCode: 401, message: 'Invalid token' };
  }

  if (err.name === 'TokenExpiredError') {
    error = { statusCode: 401, message: 'Token expired' };
  }

  // ---- Send Response ----
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    // Only send stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found Handler
 * For routes that don't match any defined route
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = { errorHandler, notFound };
