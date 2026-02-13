const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResourceSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    index: true
  },
  paperType: {
    type: String,
    required: true,
    enum: ['MTP', 'RTP', 'PYQS', 'Other', 'Model TP'],
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
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    default: 'pdf',
    index: true
  },
  fileSize: {
    type: Number
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  // Track resource popularity for recommendations
  viewCount: {
    type: Number,
    default: 0
  },
  // Add a short description for improved searchability
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  // Add average rating for resources
  rating: {
    average: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 5
    },
    count: { 
      type: Number, 
      default: 0 
    }
  },
  // Last time the file was updated (for versioning)
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Improved compound indexes for common filter combinations
ResourceSchema.index({ 
  examStage: 1, 
  subject: 1
});

ResourceSchema.index({ 
  examStage: 1, 
  subject: 1, 
  paperType: 1
});

ResourceSchema.index({ 
  examStage: 1, 
  subject: 1, 
  paperType: 1, 
  year: 1
});

// Add text index for searching with weights
ResourceSchema.index({ 
  title: 'text',
  description: 'text'
}, {
  weights: {
    title: 3,
    description: 1
  },
  name: 'resource_text_search'
});

// Index for popularity based queries
ResourceSchema.index({ 
  downloadCount: -1, 
  viewCount: -1,
  'rating.average': -1 
});

// Add an index for creation date (already being used for sorting)
ResourceSchema.index({ createdAt: -1 });

// Static method for finding popular resources
ResourceSchema.statics.findPopular = function(subject, limit = 10) {
  return this.find({ subject })
    .sort({ downloadCount: -1, viewCount: -1, 'rating.average': -1 })
    .limit(limit);
};

// Method to increment download count
ResourceSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  return this.save();
};

// Method to increment view count
ResourceSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to add a rating
ResourceSchema.methods.addRating = function(newRating) {
  if (newRating < 1 || newRating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  const totalRatingPoints = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRatingPoints / this.rating.count;
  
  return this.save();
};

module.exports = mongoose.model('Resource', ResourceSchema); 