const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const Question = require('../models/QuestionModel');
const User = require('../models/UserModel');
const { questionSchema } = require('../validators/questionValidator');
const { logAudit } = require('../utils/auditLog');
const logger = require('../config/logger');
const { sendErrorResponse } = require('../utils/errorResponse');
const { escapeRegex } = require('../utils/escapeRegex');

router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    logger.info('Received question data (raw)');

    const {
      subject,
      paperType,
      year,
      month,
      examStage,
      questionNumber,
      questionText,
      answerText,
      subQuestions,
    } = req.body;

    const dataToValidate = {
      subject,
      paperType,
      year,
      month,
      examStage,
      questionNumber,
      questionText,
      answerText: answerText || '',
      subQuestions: subQuestions || [],
    };

    logger.info('Data to validate for question create');

    const { error } = questionSchema.validate(dataToValidate, { abortEarly: false });
    if (error) {
      logger.info('Validation errors: ' + (error.details && error.details.map(d => d.message).join(', ')));
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }

    const questionData = {
      subject,
      paperType,
      year,
      month,
      examStage,
      questionNumber,
      questionText,
      answerText: answerText || '',
      subQuestions: dataToValidate.subQuestions,
    };

    const question = await Question.create(questionData);
    clearCache('/api/questions');
    await logAudit(req.user.id, 'create', 'question', question.id, { subject: question.subject, questionNumber: question.questionNumber });
    logger.info('Question created with ID: ' + question.id);
    res.status(201).json({ id: question.id, ...questionData });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to create question', error });
  }
});

router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Updating question with ID: ' + id);

    const {
      subject,
      paperType,
      year,
      month,
      examStage,
      questionNumber,
      questionText,
      answerText,
      subQuestions,
    } = req.body;

    const question = await Question.findById(id);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const dataToValidate = {
      subject: subject || question.subject,
      paperType: paperType || question.paperType,
      year: year || question.year,
      month: month || question.month,
      examStage: examStage || question.examStage,
      questionNumber: questionNumber || question.questionNumber,
      questionText: questionText || question.questionText,
      answerText: answerText || question.answerText || '',
      subQuestions: subQuestions || question.subQuestions || [],
    };

    const { error } = questionSchema.validate(dataToValidate, { abortEarly: false });
    if (error) {
      logger.info('Validation errors on update: ' + (error.details && error.details.map(d => d.message).join(', ')));
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }

    const updatedData = {
      subject: dataToValidate.subject,
      paperType: dataToValidate.paperType,
      year: dataToValidate.year,
      month: dataToValidate.month,
      examStage: dataToValidate.examStage,
      questionNumber: dataToValidate.questionNumber,
      questionText: dataToValidate.questionText,
      answerText: dataToValidate.answerText,
      subQuestions: dataToValidate.subQuestions,
    };

    await Question.findByIdAndUpdate(id, updatedData, { new: true });
    clearCache([`/api/questions?id=${id}`, '/api/questions']);
    await logAudit(req.user.id, 'update', 'question', id, { subject: updatedData.subject });
    logger.info('Question updated successfully for ID: ' + id);
    res.json({ message: 'Question updated successfully', id, ...updatedData });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to update question', error });
  }
});

router.get('/', [authMiddleware, cacheMiddleware(300)], async (req, res) => {
  try {
    const { subject, year, questionNumber, paperType, month, examStage, search, bookmarked, page, limit } = req.query;
    const filter = {};
    if (subject) filter.subject = subject;
    if (year) filter.year = year;
    if (questionNumber) filter.questionNumber = questionNumber;
    if (paperType) filter.paperType = paperType;
    if (month) filter.month = month;
    if (examStage) filter.examStage = examStage;
    
    // Handle search keyword (case-insensitive); escape to prevent regex injection
    if (search) {
      filter.questionText = {
        $regex: escapeRegex(search),
        $options: 'i'
      };
    }

    if (bookmarked === 'true') {
      const user = await User.findById(req.user.id).select('bookmarkedQuestions');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      filter._id = { $in: user.bookmarkedQuestions };
    }

    // Pagination: default limit 20, max 100
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      Question.find(filter).skip(skip).limit(limitNum),
      Question.countDocuments(filter)
    ]);

    res.json({
      data: questions,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to fetch questions', error });
  }
});

router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Attempting to delete question with ID: ' + id);
    
    if (!id || id === 'undefined') {
      return res.status(400).json({ error: 'Invalid question ID provided' });
    }
    
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    const result = await Question.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(500).json({ error: 'Failed to delete question - database operation returned null' });
    }
    
    clearCache([`/api/questions?id=${id}`, '/api/questions']);
    await logAudit(req.user.id, 'delete', 'question', id, { subject: question.subject });
    logger.info('Successfully deleted question with ID: ' + id);
    res.json({ message: 'Question deleted successfully', id });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to delete question', error });
  }
});

// Route to get the total count of questions
router.get('/count', [cacheMiddleware(3600)], async (req, res) => {
  try {
    const count = await Question.countDocuments();
    res.json({ count });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to fetch question count', error });
  }
});

// Route to fetch MCQ questions for quiz
router.get('/quiz', [authMiddleware, cacheMiddleware(900)], async (req, res) => {
  try {
    const { examStage, subject, limit = 10 } = req.query;
    
    // Validate required parameters
    if (!examStage || !subject) {
      return res.status(400).json({ error: 'Exam stage and subject are required parameters' });
    }
    
    // Create filter to find questions with MCQ (questions that have subQuestions with subOptions)
    const filter = {
      examStage,
      subject,
      'subQuestions.0': { $exists: true },  // Has at least one subQuestion
      'subQuestions.subOptions.0': { $exists: true }  // Has at least one option in the first subQuestion
    };
    
    // Fetch MCQ questions with aggregation to ensure we get questions with valid MCQs
    const mcqQuestions = await Question.aggregate([
      { $match: filter },
      { $match: { 'subQuestions.subOptions': { $exists: true, $ne: [] } } },
      // Ensure at least one option is marked as correct
      { $match: { 'subQuestions.subOptions.isCorrect': true } },
      // Randomly select questions
      { $sample: { size: parseInt(limit) } }
    ]);
    
    if (mcqQuestions.length === 0) {
      return res.status(404).json({ 
        error: 'No MCQ questions found for the selected exam stage and subject',
        examStage,
        subject
      });
    }
    
    res.json(mcqQuestions);
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to fetch quiz questions', error });
  }
});

// Route to get available subjects with MCQ questions for an exam stage
router.get('/available-subjects', [authMiddleware, cacheMiddleware(3600)], async (req, res) => {
  try {
    const { examStage } = req.query;
    
    if (!examStage) {
      return res.status(400).json({ error: 'Exam stage is required' });
    }
    
    // Find all unique subjects for the given exam stage that have MCQ questions
    const availableSubjects = await Question.aggregate([
      {
        $match: {
          examStage,
          'subQuestions.0': { $exists: true },  // Has at least one subQuestion
          'subQuestions.subOptions.0': { $exists: true }  // Has at least one option
        }
      },
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          subject: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);
    
    res.json(availableSubjects);
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to fetch available subjects', error });
  }
});

// Route to get ALL subjects for an exam stage (for AI quiz)
router.get('/all-subjects', [authMiddleware, cacheMiddleware(3600)], async (req, res) => {
  try {
    const { examStage } = req.query;
    
    if (!examStage) {
      return res.status(400).json({ error: 'Exam stage is required' });
    }
    
    // Define default subjects for each exam stage
    let defaultSubjects = [];
    
    if (examStage === 'Foundation') {
      defaultSubjects = [
        { subject: 'Accounting', count: 0 },
        { subject: 'Business Laws', count: 0 },
        { subject: 'Quantitative Aptitude', count: 0 },
        { subject: 'Business Economics', count: 0 }
      ];
    } else if (examStage === 'Intermediate') {
      defaultSubjects = [
        { subject: 'Advanced Accounting', count: 0 },
        { subject: 'Corporate Laws', count: 0 },
        { subject: 'Cost and Management Accounting', count: 0 },
        { subject: 'Taxation', count: 0 },
        { subject: 'Auditing and Code of Ethics', count: 0 },
        { subject: 'Financial and Strategic Management', count: 0 }
      ];
    } else if (examStage === 'Final') {
      defaultSubjects = [
        { subject: 'Financial Reporting', count: 0 },
        { subject: 'Advanced Financial Management', count: 0 },
        { subject: 'Advanced Auditing', count: 0 },
        { subject: 'Direct and International Tax Laws', count: 0 },
        { subject: 'Indirect Tax Laws', count: 0 },
        { subject: 'Integrated Business Solutions', count: 0 }
      ];
    }
    
    // Find all unique subjects for the given exam stage regardless of question type
    const foundSubjects = await Question.aggregate([
      {
        $match: {
          examStage
        }
      },
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          subject: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);
    
    // Create a map of default subjects for quick lookup
    const mergedSubjects = [...defaultSubjects];
    const defaultSubjectMap = new Map(defaultSubjects.map(s => [s.subject, s]));
    
    // Update counts for subjects that exist in the database
    foundSubjects.forEach(foundSubj => {
      const defaultSubj = defaultSubjectMap.get(foundSubj.subject);
      if (defaultSubj) {
        // Update the count for existing default subject
        const index = mergedSubjects.findIndex(s => s.subject === foundSubj.subject);
        if (index !== -1) {
          mergedSubjects[index].count = foundSubj.count;
        }
      } else if (examStage === foundSubj.examStage) {
        // Add any additional subjects from the database that aren't in default list
        mergedSubjects.push(foundSubj);
      }
    });
    
    res.json(mergedSubjects);
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to fetch subjects', error });
  }
});

// Add new batch endpoint to fetch multiple questions by ID
router.post('/batch', [authMiddleware], async (req, res) => {
  try {
    const { questionIds } = req.body;
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'A valid array of question IDs is required' });
    }
    
    // Limit the number of questions that can be requested at once
    if (questionIds.length > 50) {
      return res.status(400).json({ error: 'Maximum of 50 questions can be requested at once' });
    }
    
    const questions = await Question.find({ _id: { $in: questionIds } });
    
    if (!questions || questions.length === 0) {
      return res.status(404).json({ error: 'No questions found for the provided IDs' });
    }
    
    res.json(questions);
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to fetch batch questions', error });
  }
});

module.exports = router;