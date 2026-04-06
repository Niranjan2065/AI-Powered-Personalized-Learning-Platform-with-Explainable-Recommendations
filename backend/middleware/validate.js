// ============================================================
// middleware/validate.js - Request Validation Middleware
// ============================================================
// Uses express-validator to validate request bodies
// Returns consistent validation error responses

const { validationResult } = require('express-validator');

/**
 * Validate middleware
 * Checks if any validation errors exist from express-validator
 * Returns 422 with error details if validation fails
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }

  next();
};

module.exports = validate;
