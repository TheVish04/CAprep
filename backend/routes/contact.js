const express = require('express');
const router = express.Router();
const ContactSubmission = require('../models/ContactSubmissionModel');
const { authMiddleware } = require('../middleware/authMiddleware');
const { sendErrorResponse } = require('../utils/errorResponse');

// POST /api/contact/feature - Submit feature request (registered users only)
router.post('/feature', authMiddleware, async (req, res) => {
  try {
    const { featureTitle, category, description } = req.body || {};
    if (!featureTitle || !description) {
      return res.status(400).json({
        success: false,
        error: 'Feature title and description are required'
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
      featureTitle: (featureTitle || '').trim(),
      category: (category || '').trim() || undefined,
      description: (description || '').trim()
    });
    res.status(201).json({ success: true, id: doc._id, message: 'Feature request submitted successfully' });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to submit feature request', error });
  }
});

// POST /api/contact/issue - Submit issue report (registered users only)
router.post('/issue', authMiddleware, async (req, res) => {
  try {
    const { subject, description } = req.body || {};
    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        error: 'Subject and description are required'
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
      subject: (subject || '').trim(),
      description: (description || '').trim()
    });
    res.status(201).json({ success: true, id: doc._id, message: 'Issue report submitted successfully' });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to submit issue report', error });
  }
});

module.exports = router;
