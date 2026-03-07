const Joi = require('joi');

// Allow question years from 2023 through current year + 1 (e.g. 2026 when current is 2025)
const currentYear = new Date().getFullYear();
const minYear = 2023;
const maxYear = currentYear + 1;
const allowedYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(minYear + i));

/**
 * Joi schema for question validation (create and update).
 * Subject values depend on examStage: Foundation, Intermediate, or Final.
 */
const questionSchema = Joi.object({
  subject: Joi.string()
    .required()
    .when('examStage', {
      is: 'Foundation',
      then: Joi.string().valid(
        '1 - Accounting',
        '2 - Business Laws',
        '3 - Quantitative Aptitude',
        '4 - Business Economics'
      ),
      otherwise: Joi.string().when('examStage', {
        is: 'Intermediate',
        then: Joi.string().valid(
          '1 - Advanced Accounting',
          '2 - Corporate and Other Laws',
          '3 - Taxation',
          '4 - Cost and Management Accounting',
          '5 - Auditing and Ethics',
          '6 - Financial Management and Strategic Management'
        ),
        otherwise: Joi.string().valid(
          '1 - Financial Reporting',
          '2 - Advanced Financial Management',
          '3 - Advanced Auditing, Assurance and Professional Ethics',
          '4 - Direct Tax Laws and International Taxation',
          '5 - Indirect Tax Laws',
          '6 - Integrated Business Solutions (Multidisciplinary Case Study)'
        )
      })
    }),
  paperType: Joi.string().required().valid('MTP', 'RTP', 'PYQS', 'Model TP'),
  year: Joi.string().required().valid(...allowedYears),
  month: Joi.string().required().valid(
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ),
  examStage: Joi.string().required().valid('Foundation', 'Intermediate', 'Final'),
  questionNumber: Joi.string().required(),
  questionText: Joi.string().allow('').optional(),
  answerText: Joi.string().allow('').optional(),
  subQuestions: Joi.array()
    .optional()
    .items(
      Joi.object({
        subQuestionNumber: Joi.string().allow('').optional(),
        subQuestionText: Joi.string().allow('').optional(),
        subOptions: Joi.array()
          .optional()
          .items(
            Joi.object({
              optionText: Joi.string().allow('').optional(),
              isCorrect: Joi.boolean().default(false),
            })
          ),
      })
    ),
});

module.exports = { questionSchema };
