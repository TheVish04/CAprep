const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const User = require('../models/UserModel');
const Resource = require('../models/ResourceModel');
const Announcement = require('../models/AnnouncementModel');

// GET /api/admin/analytics - Fetch aggregated analytics data
router.get('/analytics', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // 1. Most Downloaded Resources (Top 10)
        const topResources = await Resource.find({ downloadCount: { $gt: 0 } })
                                            .sort({ downloadCount: -1 })
                                            .limit(10)
                                            .select('title downloadCount'); // Select only needed fields

        // 2. Quizzes Taken Per Subject
        // $unwind breaks the quizHistory array into individual documents
        // $group groups them by subject and counts
        // $sort sorts by count descending
        const quizzesPerSubject = await User.aggregate([
            { $unwind: '$quizHistory' },
            { $group: { 
                _id: '$quizHistory.subject', // Group by subject
                count: { $sum: 1 }          // Count quizzes per subject
            }},
            { $sort: { count: -1 } }          // Sort by count descending
        ]);

        // 3. Total Donations Received
        // $group calculates the sum of totalContribution across all users
        const totalDonationsResult = await User.aggregate([
            { $group: {
                _id: null, // Group all users together
                total: { $sum: '$totalContribution' }
            }}
        ]);
        const totalDonations = totalDonationsResult.length > 0 ? totalDonationsResult[0].total : 0;

        // Combine results
        const analytics = {
            topDownloadedResources: topResources,
            quizzesTakenPerSubject: quizzesPerSubject,
            totalDonationsReceived: totalDonations
        };

        res.json(analytics);

    } catch (error) {
        console.error('Error fetching admin analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// Create announcement
router.post('/announcements', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, type, priority, targetSubjects, validUntil } = req.body;
    
    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }
    
    // Create announcement
    const announcement = new Announcement({
      title,
      content,
      type: type || 'general',
      priority: priority || 'medium',
      targetSubjects: targetSubjects || [],
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.user.id
    });
    
    await announcement.save();
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Error creating announcement', error: error.message });
  }
});

// Get all announcements
router.get('/announcements', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Apply filters
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.priority) filter.priority = req.query.priority;
    
    // Only filter by validUntil if not showing all announcements
    if (req.query.showAll !== 'true') {
      filter.validUntil = { $gte: new Date() };
    }
    
    // Get announcements with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'fullName');
    
    const total = await Announcement.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: announcements,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving announcements', error: error.message });
  }
});

// Update announcement
router.put('/announcements/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, priority, targetSubjects, validUntil } = req.body;
    
    // Find announcement
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    // Update fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (priority) announcement.priority = priority;
    if (targetSubjects) announcement.targetSubjects = targetSubjects;
    if (validUntil) announcement.validUntil = new Date(validUntil);
    
    await announcement.save();
    
    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Error updating announcement', error: error.message });
  }
});

// Delete announcement
router.delete('/announcements/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and delete announcement
    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Error deleting announcement', error: error.message });
  }
});

// Add other admin-specific routes here later if needed

module.exports = router; 