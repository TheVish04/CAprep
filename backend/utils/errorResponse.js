const logger = require('../config/logger');

/**
 * Send a consistent error response and log server-side.
 * In production, never sends error.message or stack in the response (no info leakage).
 * In development, optionally includes details for debugging.
 *
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (e.g. 400, 500)
 * @param {object} options - Options
 * @param {string} [options.message='Something went wrong'] - Generic message shown to the client
 * @param {Error} [options.error] - Caught error; logged server-side, details only in response when NODE_ENV=development
 */
function sendErrorResponse(res, statusCode = 500, options = {}) {
  const { message = 'Something went wrong', error } = options;

  if (error) {
    logger.error(message + ': ' + (error.message || String(error)));
  }

  const payload = { error: message };
  if (statusCode >= 400) {
    payload.success = false;
  }
  if (process.env.NODE_ENV === 'development' && error) {
    payload.details = error.message || String(error);
  }

  res.status(statusCode).json(payload);
}

module.exports = { sendErrorResponse };
