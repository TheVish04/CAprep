const express = require('express');
const router = express.Router();
const ContactSubmission = require('../models/ContactSubmissionModel');
const { authMiddleware } = require('../middleware/authMiddleware');
const { sendErrorResponse } = require('../utils/errorResponse');
const { featureRequestSchema, issueReportSchema } = require('../validators/contactValidator');

// POST /api/contact/feature - Submit feature request (registered users only)
router.post('/feature', authMiddleware, async (req, res) => {
  try {
    const { error, value } = featureRequestSchema.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details.map(d => d.message).join(', ')
      });
    }
    const name = (req.user && req.user.fullName) ? String(req.user.fullName).trim() : '';
    const email = (req.user && req.user.email) ? String(req.user.email).trim().toLowerCase() : '';
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'User name and email are required' });
    }
    const doc = await ContactSubmission.create({
      type: 'feature',
      name,
      email,
      featureTitle: value.featureTitle,
      category: value.category || undefined,
      description: value.description
    });
    res.status(201).json({ success: true, id: doc._id, message: 'Feature request submitted successfully' });
  } catch (err) {
    sendErrorResponse(res, 500, { message: 'Failed to submit feature request', error: err });
  }
});

// POST /api/contact/issue - Submit issue report (registered users only)
router.post('/issue', authMiddleware, async (req, res) => {
  try {
    const { error, value } = issueReportSchema.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details.map(d => d.message).join(', ')
      });
    }
    const name = (req.user && req.user.fullName) ? String(req.user.fullName).trim() : '';
    const email = (req.user && req.user.email) ? String(req.user.email).trim().toLowerCase() : '';
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'User name and email are required' });
    }
    const doc = await ContactSubmission.create({
      type: 'issue',
      name,
      email,
      subject: value.subject,
      description: value.description
    });
    res.status(201).json({ success: true, id: doc._id, message: 'Issue report submitted successfully' });
  } catch (err) {
    sendErrorResponse(res, 500, { message: 'Failed to submit issue report', error: err });
  }
});

module.exports = router;
