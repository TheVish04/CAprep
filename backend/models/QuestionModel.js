const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubOptionSchema = new Schema({
  optionText: {
    type: String,
    default: ''
  },
  isCorrect: {
    type: Boolean,
    default: false
  }
}, { _id: false }); // Disable _id to reduce document size

const SubQuestionSchema = new Schema({
  subQuestionNumber: {
    type: String,
    default: null,
    select: false
  },
  subQuestionText: {
    type: String,
    default: ''
  },
  subOptions: [SubOptionSchema]
}, { _id: false }); // Disable _id to reduce document size

const QuestionSchema = new Schema({
  subject: {
    type: String,
    required: true,
    index: true
  },
  paperType: {
    type: String,
    required: true,
    enum: ['MTP', 'RTP', 'PYQS', 'Model TP'],
    index: true
  },
  year: {
    type: String,
    required: true,
    index: true
  },
  month: {
    type: String,
    required: true,
    enum: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    index: true
  },
  examStage: {
    type: String,
    required: true,
    enum: ['Foundation', 'Intermediate', 'Final'],
    index: true
  },
  questionNumber: {
    type: String,
    required: true
  },
  questionText: {
    type: String
  },
  answerText: {
    type: String
  },
  subQuestions: {
    type: [SubQuestionSchema],
    default: []
  },
  // Add difficulty level field for better filtering
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  // Track question popularity for recommendations
  viewCount: {
    type: Number,
    default: 0
  },
  // Track correctness rate for analytics
  attemptCount: {
    type: Number,
    default: 0
  },
  correctCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for calculating success rate
QuestionSchema.virtual('successRate').get(function() {
  if (this.attemptCount === 0) return 0;
  return (this.correctCount / this.attemptCount) * 100;
});

// Improved compound index for common filter combinations
QuestionSchema.index({ 
  examStage: 1, 
  subject: 1
});

QuestionSchema.index({ 
  examStage: 1, 
  subject: 1, 
  paperType: 1
});

QuestionSchema.index({ 
  examStage: 1, 
  subject: 1, 
  paperType: 1, 
  year: 1
});

// Add index for difficulty-based queries
QuestionSchema.index({ difficulty: 1 });

// Add compound index for popularity-based queries
QuestionSchema.index({ viewCount: -1, subject: 1 });

// Add text index for searching question text with weights
QuestionSchema.index({ 
  questionText: 'text',
  'subQuestions.subQuestionText': 'text'
}, {
  weights: {
    questionText: 3,
    'subQuestions.subQuestionText': 2
  },
  name: 'question_text_search'
});

// Static method for finding popular questions
QuestionSchema.statics.findPopular = function(subject, limit = 10) {
  return this.find({ subject })
    .sort({ viewCount: -1, createdAt: -1 })
    .limit(limit);
};

// Static method for finding questions by difficulty
QuestionSchema.statics.findByDifficulty = function(subject, difficulty, limit = 10) {
  return this.find({ subject, difficulty })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Method to increment view count
QuestionSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to track attempt
QuestionSchema.methods.trackAttempt = function(isCorrect) {
  this.attemptCount += 1;
  if (isCorrect) {
    this.correctCount += 1;
  }
  return this.save();
};

module.exports = mongoose.model('Question', QuestionSchema);