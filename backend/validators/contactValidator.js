const Joi = require('joi');

/** Max lengths aligned with ContactSubmissionModel */
const LIMITS = {
  featureTitle: 300,
  category: 100,
  description: 5000,
  subject: 300
};

/**
 * Joi schema for POST /api/contact/feature (feature request).
 * Validates type, length, and trims strings.
 */
const featureRequestSchema = Joi.object({
  featureTitle: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(LIMITS.featureTitle)
    .messages({
      'string.empty': 'Feature title is required',
      'any.required': 'Feature title is required',
      'string.max': `Feature title must be at most ${LIMITS.featureTitle} characters`
    }),
  category: Joi.string()
    .optional()
    .allow('')
    .trim()
    .max(LIMITS.category)
    .messages({
      'string.max': `Category must be at most ${LIMITS.category} characters`
    }),
  description: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(LIMITS.description)
    .messages({
      'string.empty': 'Description is required',
      'any.required': 'Description is required',
      'string.max': `Description must be at most ${LIMITS.description} characters`
    })
}).unknown(false);

/**
 * Joi schema for POST /api/contact/issue (issue report).
 */
const issueReportSchema = Joi.object({
  subject: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(LIMITS.subject)
    .messages({
      'string.empty': 'Subject is required',
      'any.required': 'Subject is required',
      'string.max': `Subject must be at most ${LIMITS.subject} characters`
    }),
  description: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(LIMITS.description)
    .messages({
      'string.empty': 'Description is required',
      'any.required': 'Description is required',
      'string.max': `Description must be at most ${LIMITS.description} characters`
    })
}).unknown(false);

module.exports = {
  featureRequestSchema,
  issueReportSchema,
  LIMITS
};
