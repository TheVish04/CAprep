const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: 200 // Limit title length
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    trim: true,
    maxlength: 5000 // Limit content length
  },
  type: {
    type: String,
    required: true,
    enum: ['system', 'syllabus', 'exam', 'general', 'feature'],
    default: 'general',
    index: true // Index for type-based queries
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true // Index for priority-based sorting
  },
  targetSubjects: [{
    type: String
  }],
  validUntil: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
    index: true // Index for validity filtering
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Track view counts for analytics
  viewCount: {
    type: Number,
    default: 0
  },
  // Allow dismissal by users
  dismissedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // For important announcements that need acknowledgment
  needsAcknowledgment: {
    type: Boolean,
    default: false
  },
  // Track users who acknowledged 
  acknowledgedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create compound indexes for common queries
AnnouncementSchema.index({ type: 1, priority: -1 });
AnnouncementSchema.index({ validUntil: 1, priority: -1 });
AnnouncementSchema.index({ createdAt: -1 }); // For time-based sorting

// Text index for searching
AnnouncementSchema.index({ 
  title: 'text', 
  content: 'text' 
}, {
  weights: {
    title: 3,
    content: 1
  },
  name: 'announcement_text_search'
});

// Add virtual for isActive
AnnouncementSchema.virtual('isActive').get(function() {
  return new Date(this.validUntil) > new Date();
});

// Add virtual for acknowledgmentCount
AnnouncementSchema.virtual('acknowledgmentCount').get(function() {
  return this.acknowledgedBy ? this.acknowledgedBy.length : 0;
});

// Add virtual for dismissalCount
AnnouncementSchema.virtual('dismissalCount').get(function() {
  return this.dismissedBy ? this.dismissedBy.length : 0;
});

// Static method to find active announcements
AnnouncementSchema.statics.findActive = function(limit = 10) {
  return this.find({
    validUntil: { $gte: new Date() }
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

// Static method to find announcements by subject
AnnouncementSchema.statics.findBySubject = function(subject) {
  return this.find({
    validUntil: { $gte: new Date() },
    $or: [
      { targetSubjects: subject },
      { targetSubjects: { $size: 0 } } // Empty array means all subjects
    ]
  })
  .sort({ priority: -1, createdAt: -1 });
};

// Method to increment view count
AnnouncementSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to add user to dismissedBy
AnnouncementSchema.methods.dismiss = function(userId) {
  // Only add if not already dismissed
  if (!this.dismissedBy.some(id => id.equals(userId))) {
    this.dismissedBy.push(userId);
  }
  return this.save();
};

// Method to add user to acknowledgedBy
AnnouncementSchema.methods.acknowledge = function(userId) {
  // Only add if not already acknowledged
  if (!this.acknowledgedBy.some(item => item.userId.equals(userId))) {
    this.acknowledgedBy.push({
      userId,
      timestamp: new Date()
    });
  }
  return this.save();
};

module.exports = mongoose.model('Announcement', AnnouncementSchema); 