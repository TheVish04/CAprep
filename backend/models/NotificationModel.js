const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    trim: true,
    enum: ['announcement', 'reply', 'system', 'general'],
    default: 'general',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  body: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  refId: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  refType: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
