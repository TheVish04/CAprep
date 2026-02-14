const Joi = require('joi');

/** Max lengths and enums aligned with AnnouncementModel */
const TITLE_MAX = 200;
const CONTENT_MAX = 5000;
const TARGET_SUBJECT_MAX_ITEMS = 50;
const TARGET_SUBJECT_ITEM_MAX_LENGTH = 200;

const announcementTypeEnum = ['system', 'syllabus', 'exam', 'general', 'feature'];
const priorityEnum = ['low', 'medium', 'high', 'urgent'];

/** validUntil: ISO date string or timestamp (ms). */
const validUntilSchema = Joi.alternatives()
  .try(
    Joi.string().isoDate(),
    Joi.number().integer().min(0)
  )
  .messages({ 'alternatives.match': 'validUntil must be a valid date (ISO string or timestamp in ms)' });

/**
 * Joi schema for POST /api/admin/announcements (create).
 */
const announcementCreateSchema = Joi.object({
  title: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(TITLE_MAX)
    .messages({
      'string.empty': 'Title is required',
      'any.required': 'Title and content are required'
    }),
  content: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(CONTENT_MAX)
    .messages({
      'string.empty': 'Content is required',
      'any.required': 'Title and content are required'
    }),
  type: Joi.string()
    .optional()
    .valid(...announcementTypeEnum)
    .default('general'),
  priority: Joi.string()
    .optional()
    .valid(...priorityEnum)
    .default('medium'),
  targetSubjects: Joi.array()
    .optional()
    .items(Joi.string().trim().max(TARGET_SUBJECT_ITEM_MAX_LENGTH))
    .max(TARGET_SUBJECT_MAX_ITEMS)
    .default([]),
  validUntil: validUntilSchema.optional()
}).unknown(false);

/**
 * Joi schema for PUT /api/admin/announcements/:id (update).
 * All fields optional; validated when provided.
 */
const announcementUpdateSchema = Joi.object({
  title: Joi.string()
    .optional()
    .trim()
    .min(1)
    .max(TITLE_MAX),
  content: Joi.string()
    .optional()
    .trim()
    .min(1)
    .max(CONTENT_MAX),
  type: Joi.string()
    .optional()
    .valid(...announcementTypeEnum),
  priority: Joi.string()
    .optional()
    .valid(...priorityEnum),
  targetSubjects: Joi.array()
    .optional()
    .items(Joi.string().trim().max(TARGET_SUBJECT_ITEM_MAX_LENGTH))
    .max(TARGET_SUBJECT_MAX_ITEMS),
  validUntil: validUntilSchema.optional()
}).min(1).unknown(false);

module.exports = {
  announcementCreateSchema,
  announcementUpdateSchema,
  TITLE_MAX,
  CONTENT_MAX
};
