const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const User = require('../models/UserModel');
const Resource = require('../models/ResourceModel');
const Question = require('../models/QuestionModel');
const Discussion = require('../models/DiscussionModel');
const Announcement = require('../models/AnnouncementModel');
const AuditLog = require('../models/AuditLogModel');
const Notification = require('../models/NotificationModel');
const ContactSubmission = require('../models/ContactSubmissionModel');
const { logAudit } = require('../utils/auditLog');

// GET /api/admin/users - List users with pagination (admin only)
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}).select('-password -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments({})
    ]);

    res.status(200).json({
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/analytics - Fetch aggregated analytics data
router.get('/analytics', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [
            topResources,
            quizzesPerSubject,
            totalUsers,
            usersByRole,
            totalResources,
            totalQuestions,
            totalDiscussions,
            totalQuizAttemptsResult,
            newUsersLast30Days,
            resourcesBySubject,
            questionsBySubject
        ] = await Promise.all([
            Resource.find({ downloadCount: { $gt: 0 } })
                .sort({ downloadCount: -1 })
                .limit(10)
                .select('title downloadCount'),
            User.aggregate([
                { $unwind: '$quizHistory' },
                { $group: { _id: '$quizHistory.subject', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).hint({ 'quizHistory.date': -1 }),
            User.countDocuments({}),
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
            Resource.countDocuments({}),
            Question.countDocuments({}),
            Discussion.countDocuments({}),
            User.aggregate([
                { $project: { count: { $size: { $ifNull: ['$quizHistory', []] } } } },
                { $group: { _id: null, total: { $sum: '$count' } } }
            ]),
            User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
            Resource.aggregate([
                { $group: { _id: '$subject', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Question.aggregate([
                { $group: { _id: '$subject', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        const totalQuizAttempts = totalQuizAttemptsResult[0]?.total ?? 0;

        const analytics = {
            topDownloadedResources: topResources,
            quizzesTakenPerSubject: quizzesPerSubject,
            totalUsers,
            usersByRole: usersByRole.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {}),
            totalResources,
            totalQuestions,
            totalDiscussions,
            totalQuizAttempts,
            newUsersLast30Days,
            resourcesBySubject,
            questionsBySubject
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
    await logAudit(req.user.id, 'create', 'announcement', announcement._id, { title: announcement.title });

    // In-app notifications for all users (fire-and-forget to avoid blocking response)
    User.find({}).select('_id').lean().then((users) => {
      if (users.length === 0) return;
      const docs = users.map((u) => ({
        user: u._id,
        type: 'announcement',
        title: announcement.title,
        body: (announcement.content || '').slice(0, 500),
        refId: announcement._id,
        refType: 'Announcement'
      }));
      return Notification.insertMany(docs);
    }).catch((err) => console.error('Create notifications for announcement:', err));

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
    await logAudit(req.user.id, 'update', 'announcement', announcement._id, { title: announcement.title });

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
    await logAudit(req.user.id, 'delete', 'announcement', announcement._id, { title: announcement.title });

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Error deleting announcement', error: error.message });
  }
});

// GET /api/admin/audit - Paginated audit log (admin only)
router.get('/audit', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'fullName email'),
      AuditLog.countDocuments({})
    ]);

    res.status(200).json({
      data: logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/admin/contact/feature-requests - List feature requests from Contact Us (admin only)
router.get('/contact/feature-requests', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const submissions = await ContactSubmission.find({ type: 'feature' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    console.error('Error fetching feature requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feature requests', error: error.message });
  }
});

// GET /api/admin/contact/report-issues - List issue reports from Contact Us (admin only)
router.get('/contact/report-issues', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const submissions = await ContactSubmission.find({ type: 'issue' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    console.error('Error fetching report issues:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch issue reports', error: error.message });
  }
});

module.exports = router; 