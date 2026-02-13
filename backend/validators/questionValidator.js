const Joi = require('joi');

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
        'Accounting',
        'Business Laws',
        'Quantitative Aptitude',
        'Business Economics'
      ),
      otherwise: Joi.string().when('examStage', {
        is: 'Intermediate',
        then: Joi.string().valid(
          'Advanced Accounting',
          'Corporate Laws',
          'Cost and Management Accounting',
          'Taxation',
          'Auditing and Code of Ethics',
          'Financial and Strategic Management'
        ),
        otherwise: Joi.string().valid(
          'Financial Reporting',
          'Advanced Financial Management',
          'Advanced Auditing',
          'Direct and International Tax Laws',
          'Indirect Tax Laws',
          'Integrated Business Solutions'
        )
      })
    }),
  paperType: Joi.string().required().valid('MTP', 'RTP', 'PYQS', 'Model TP'),
  year: Joi.string().required().valid('2025', '2024', '2023'),
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
