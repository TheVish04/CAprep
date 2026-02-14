const express = require('express');
const router = express.Router();
const Announcement = require('../models/AnnouncementModel');
const mongoose = require('mongoose');
const logger = require('../config/logger');

// GET /api/announcements - Get active announcements (auth required)
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const announcements = await Announcement.find({
      validUntil: { $gte: new Date() }
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'fullName');

    res.status(200).json({
      success: true,
      data: announcements
    });
  } catch (error) {
    logger.error('Announcements retrieval error: ' + (error && error.message));
    res.status(500).json({
      success: false,
      message: 'Error retrieving announcements',
      error: error.message
    });
  }
});

// PATCH /api/announcements/:id/dismiss - Dismiss announcement for current user
router.patch('/:id/dismiss', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid announcement ID' });
    }
    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });
    await announcement.dismiss(userId);
    res.status(200).json({ success: true, message: 'Announcement dismissed' });
  } catch (error) {
    logger.error('Announcement dismiss error: ' + (error && error.message));
    res.status(500).json({ success: false, message: 'Failed to dismiss', error: error.message });
  }
});

// PATCH /api/announcements/:id/acknowledge - Acknowledge announcement for current user
router.patch('/:id/acknowledge', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid announcement ID' });
    }
    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });
    await announcement.acknowledge(userId);
    res.status(200).json({ success: true, message: 'Announcement acknowledged' });
  } catch (error) {
    logger.error('Announcement acknowledge error: ' + (error && error.message));
    res.status(500).json({ success: false, message: 'Failed to acknowledge', error: error.message });
  }
});

module.exports = router;
