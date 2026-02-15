const express = require('express');
const router = express.Router();
const Notification = require('../models/NotificationModel');
const logger = require('../config/logger');

// GET /api/notifications - List notifications for current user (auth required via server mount)
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const unreadOnly = req.query.unreadOnly === 'true';
    const skip = (page - 1) * limit;

    const filter = { user: userId };
    if (unreadOnly) filter.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter)
    ]);

    const unreadCount = await Notification.countDocuments({ user: userId, read: false });

    res.status(200).json({
      data: notifications,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      unreadCount
    });
  } catch (error) {
    logger.error('Notifications list error: ' + (error && error.message));
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read for current user (must be before /:id/read)
router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await Notification.updateMany({ user: userId, read: false }, { read: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all read error: ' + (error && error.message));
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    logger.error('Mark read error: ' + (error && error.message));
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;
