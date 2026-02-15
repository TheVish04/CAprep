const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ContactSubmissionSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['feature', 'issue'],
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 320
  },
  // For issue reports
  subject: {
    type: String,
    trim: true,
    maxlength: 300
  },
  // For feature requests (short title)
  featureTitle: {
    type: String,
    trim: true,
    maxlength: 300
  },
  category: {
    type: String,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  status: {
    type: String,
    enum: ['new', 'read', 'archived'],
    default: 'new',
    index: true
  }
}, {
  timestamps: true
});

ContactSubmissionSchema.index({ type: 1, createdAt: -1 });
// status index is already defined via index: true on the field

module.exports = mongoose.model('ContactSubmission', ContactSubmissionSchema);
