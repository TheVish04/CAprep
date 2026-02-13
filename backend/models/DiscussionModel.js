const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000 // Limit message length
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  parentMessageId: {
    type: Schema.Types.ObjectId,
    default: null,
    index: true // Index for threaded replies
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { 
  _id: true, // We need _id for message referencing
  timestamps: false // We'll use the timestamp field directly
});

// Add virtual for like count
MessageSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

const DiscussionSchema = new Schema({
  itemType: {
    type: String,
    enum: ['question', 'resource'],
    required: true,
    index: true
  },
  itemId: {
    type: Schema.Types.ObjectId,
    required: true,
    // Dynamic reference based on itemType
    refPath: 'itemModel',
    index: true
  },
  itemModel: {
    type: String,
    required: true,
    enum: ['Question', 'Resource'],
    index: true
  },
  // Track last activity for sorting
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Track message count for analytics
  messageCount: {
    type: Number,
    default: 0
  },
  // Track unique participants count
  participantCount: {
    type: Number,
    default: 0
  },
  // Store messages as array
  messages: [MessageSchema],
  // Store participants as array of user IDs
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create compound indexes for faster queries
DiscussionSchema.index({ itemType: 1, itemId: 1 }, { unique: true });
DiscussionSchema.index({ participants: 1 });
DiscussionSchema.index({ createdAt: -1 }); // For time-based sorting
DiscussionSchema.index({ lastActivityAt: -1 }); // For activity-based sorting
DiscussionSchema.index({ messageCount: -1 }); // For popularity-based sorting

// Index for text search in discussion content
DiscussionSchema.index({ 
  'messages.content': 'text'
}, { 
  name: 'message_content_search'
});

// Static method to find active discussions
DiscussionSchema.statics.findActive = function(limit = 10) {
  return this.find()
    .sort({ lastActivityAt: -1 })
    .limit(limit)
    .populate('participants', 'fullName');
};

// Method to add a message
DiscussionSchema.methods.addMessage = function(userId, content, parentMessageId = null) {
  // Create new message
  const newMessage = {
    userId,
    content,
    timestamp: new Date(),
    parentMessageId
  };
  
  // Add to messages array
  this.messages.push(newMessage);
  
  // Update lastActivityAt
  this.lastActivityAt = new Date();
  
  // Increment message count
  this.messageCount += 1;
  
  // Add user to participants if not already included
  if (!this.participants.some(participantId => participantId.equals(userId))) {
    this.participants.push(userId);
    this.participantCount += 1;
  }
  
  return this.save();
};

// Method to delete message
DiscussionSchema.methods.deleteMessage = function(messageId) {
  const message = this.messages.id(messageId);
  
  if (!message) {
    throw new Error('Message not found');
  }
  
  message.deleted = true;
  message.deletedAt = new Date();
  
  return this.save();
};

// Method to edit message
DiscussionSchema.methods.editMessage = function(messageId, newContent) {
  const message = this.messages.id(messageId);
  
  if (!message) {
    throw new Error('Message not found');
  }
  
  message.content = newContent;
  message.edited = true;
  message.editedAt = new Date();
  
  return this.save();
};

// Method to add like to message
DiscussionSchema.methods.likeMessage = function(messageId, userId) {
  const message = this.messages.id(messageId);
  
  if (!message) {
    throw new Error('Message not found');
  }
  
  // Only add like if not already liked
  if (!message.likes.some(likeId => likeId.equals(userId))) {
    message.likes.push(userId);
  }
  
  return this.save();
};

// Method to remove like from message
DiscussionSchema.methods.unlikeMessage = function(messageId, userId) {
  const message = this.messages.id(messageId);
  
  if (!message) {
    throw new Error('Message not found');
  }
  
  // Remove user from likes array
  message.likes = message.likes.filter(likeId => !likeId.equals(userId));
  
  return this.save();
};

module.exports = mongoose.model('Discussion', DiscussionSchema); 