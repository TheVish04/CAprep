const express = require('express');
const router = express.Router();
const Announcement = require('../models/AnnouncementModel');

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
    console.error('Announcements retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving announcements',
      error: error.message
    });
  }
});

module.exports = router;
