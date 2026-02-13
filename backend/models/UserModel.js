const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Separate schemas for embedded subdocuments to improve readability and reusability
const QuestionAttemptSchema = new Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question', 
    required: true,
    get: v => String(v) // Always return as string to avoid ObjectId issues
  },
  subQuestionIndex: { type: Number, required: true, default: 0 },
  selectedOptionIndex: { type: Number, required: false },
  correctOptionIndex: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  isAiGenerated: { type: Boolean, default: false },
  // Store minimal data for AI questions to reduce document size
  questionText: { type: String, required: false, maxlength: 1000 },
  optionTexts: [{ type: String, maxlength: 500 }],
  explanation: { type: String, required: false, maxlength: 1000 }
}, { _id: false }); // Disable _id for subdocuments to reduce document size

const QuizHistorySchema = new Schema({
  subject: { type: String, required: true, index: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  date: { type: Date, default: Date.now, index: true },
  isAiQuiz: { type: Boolean, default: false },
  questionsAttempted: [QuestionAttemptSchema]
}, { _id: true }); // Keep _id for direct referencing

const StudyHourSchema = new Schema({
  date: { type: Date, required: true, index: true },
  hours: { type: Number, required: true, min: 0 },
  subject: { type: String, required: false, index: true }
}, { _id: false });

// --- Bookmark Folder and Note Schemas ---
const BookmarkNoteSchema = new Schema({
  note: { type: String, maxlength: 1000, default: '' }
}, { _id: false });

const BookmarkItemSchema = new Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Question or Resource ID
  note: { type: String, maxlength: 1000, default: '' },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const BookmarkFolderSchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  type: { type: String, enum: ['question', 'resource'], required: true },
  items: [BookmarkItemSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

const SubjectStrengthSchema = new Schema({
  subject: { type: String, required: true },
  strengthScore: { type: Number, required: true, min: 0, max: 100 },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    match: [/^[A-Za-z ]+$/i, 'Full name can only contain letters and spaces'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    index: true // Add explicit index for email queries
  },
  profilePicture: {
    type: String,
    default: 'https://res.cloudinary.com/demo/image/upload/v1/samples/default-avatar.png'
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in query results by default
  },
  role: {
    type: String,
    required: true,
    default: 'user',
    enum: ['user', 'admin'],
    index: true // Add index for role-based queries
  },
  resetPasswordToken: {
    type: String,
    default: null,
    select: false // Only include when explicitly requested
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
    select: false // Only include when explicitly requested
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  bookmarkedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  quizHistory: {
    type: [QuizHistorySchema],
    default: [],
    // Limit array size to prevent document growth issues
    validate: [
      function(val) {
        return val.length <= 100; 
      },
      'Quiz history cannot exceed 100 entries'
    ]
  },
  bookmarkedResources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  }],
  totalContribution: {
    type: Number,
    default: 0,
    min: 0
  },
  studyHours: {
    type: [StudyHourSchema],
    default: [],
    validate: [
      function(val) {
        return val.length <= 365; // Limit to ~1 year of daily entries
      },
      'Study hours cannot exceed 365 entries'
    ]
  },
  recentlyViewedQuestions: {
    type: [{
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      viewedAt: { type: Date, default: Date.now }
    }],
    default: [],
    validate: [
      function(val) {
        return val.length <= 50;
      },
      'Recently viewed questions cannot exceed 50 entries'
    ]
  },
  recentlyViewedResources: {
    type: [{
      resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
      viewedAt: { type: Date, default: Date.now }
    }],
    default: [],
    validate: [
      function(val) {
        return val.length <= 50;
      },
      'Recently viewed resources cannot exceed 50 entries'
    ]
  },
  subjectStrengths: {
    type: [SubjectStrengthSchema],
    default: []
  },
  resourceEngagement: {
    type: [{
      resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
      timeSpent: { type: Number, default: 0 }, // In seconds
      lastAccessed: { type: Date, default: Date.now },
      accessCount: { type: Number, default: 1 }
    }],
    default: [],
    validate: [
      function(val) {
        return val.length <= 100;
      },
      'Resource engagement cannot exceed 100 entries'
    ]
  },
  // --- Bookmark Folders ---
  bookmarkFolders: {
    type: [BookmarkFolderSchema],
    default: []
  }
}, {
  timestamps: true,
  // Add lean option to improve query performance
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Compound indexes for common query patterns
UserSchema.index({ role: 1, createdAt: -1 }); // For admin user listing
UserSchema.index({ 'studyHours.date': -1 }); // For date-based study hour queries
UserSchema.index({ 'quizHistory.date': -1 }); // For quiz history sorting

// Add a virtual to get total quiz count
UserSchema.virtual('quizCount').get(function() {
  return this.quizHistory ? this.quizHistory.length : 0;
});

// Add a static method for faster auth verification
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email }).select('+password');
};

// Add a method to limit recently viewed items (maintain fixed size)
UserSchema.methods.addRecentlyViewedQuestion = function(questionId) {
  // Remove if already exists
  this.recentlyViewedQuestions = this.recentlyViewedQuestions.filter(
    item => !item.questionId.equals(questionId)
  );
  
  // Add to beginning
  this.recentlyViewedQuestions.unshift({
    questionId,
    viewedAt: new Date()
  });
  
  // Limit to 50 items
  if (this.recentlyViewedQuestions.length > 50) {
    this.recentlyViewedQuestions = this.recentlyViewedQuestions.slice(0, 50);
  }
  
  return this;
};

// Add similar method for resources
UserSchema.methods.addRecentlyViewedResource = function(resourceId) {
  this.recentlyViewedResources = this.recentlyViewedResources.filter(
    item => !item.resourceId.equals(resourceId)
  );
  
  this.recentlyViewedResources.unshift({
    resourceId,
    viewedAt: new Date()
  });
  
  if (this.recentlyViewedResources.length > 50) {
    this.recentlyViewedResources = this.recentlyViewedResources.slice(0, 50);
  }
  
  return this;
};

module.exports = mongoose.model('User', UserSchema);