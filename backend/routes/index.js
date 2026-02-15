const { authMiddleware } = require('../middleware/authMiddleware');
const authRoutes = require('../controllers/auth');
const questionRoutes = require('../controllers/questions');
const resourceRoutes = require('../controllers/resources');
const userRoutes = require('../controllers/users');
const adminRoutes = require('../controllers/admin');
const discussionRoutes = require('../controllers/discussions');
const aiQuizRoutes = require('../controllers/aiQuiz');
const dashboardRoutes = require('../controllers/dashboard');
const announcementRoutes = require('../controllers/announcements');
const notificationRoutes = require('../controllers/notifications');
const contactRoutes = require('../controllers/contact');
const logger = require('../config/logger');

/**
 * Mount all API routes on the Express app.
 * @param {import('express').Application} app - Express application instance
 */
const mountRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai-quiz', aiQuizRoutes);
  app.use('/api/discussions', discussionRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/announcements', authMiddleware, announcementRoutes);
  app.use('/api/notifications', authMiddleware, notificationRoutes);
  app.use('/api/contact', contactRoutes);
  logger.info('API routes initialized successfully');
};

module.exports = { mountRoutes };
