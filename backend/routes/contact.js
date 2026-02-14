const express = require('express');
const router = express.Router();
const ContactSubmission = require('../models/ContactSubmissionModel');

// POST /api/contact/feature - Submit feature request (public)
router.post('/feature', async (req, res) => {
  try {
    const { name, email, featureTitle, category, description } = req.body || {};
    if (!name || !email || !featureTitle || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, feature title, and description are required'
      });
    }
    const doc = await ContactSubmission.create({
      type: 'feature',
      name: name.trim(),
      email: email.trim().toLowerCase(),
      featureTitle: (featureTitle || '').trim(),
      category: (category || '').trim() || undefined,
      description: (description || '').trim()
    });
    res.status(201).json({ success: true, id: doc._id, message: 'Feature request submitted successfully' });
  } catch (error) {
    console.error('Contact feature submit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feature request',
      error: error.message
    });
  }
});

// POST /api/contact/issue - Submit issue report (public)
router.post('/issue', async (req, res) => {
  try {
    const { name, email, subject, description } = req.body || {};
    if (!name || !email || !subject || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, subject, and description are required'
      });
    }
    const doc = await ContactSubmission.create({
      type: 'issue',
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: (subject || '').trim(),
      description: (description || '').trim()
    });
    res.status(201).json({ success: true, id: doc._id, message: 'Issue report submitted successfully' });
  } catch (error) {
    console.error('Contact issue submit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit issue report',
      error: error.message
    });
  }
});

module.exports = router;
