const { authMiddleware } = require('../middleware/authMiddleware');
const authRoutes = require('../routes/auth');
const questionRoutes = require('../routes/questions');
const resourceRoutes = require('../routes/resources');
const userRoutes = require('../routes/users');
const adminRoutes = require('../routes/admin');
const discussionRoutes = require('../routes/discussions');
const aiQuizRoutes = require('../routes/aiQuiz');
const dashboardRoutes = require('../routes/dashboard');
const announcementRoutes = require('../routes/announcements');
const notificationRoutes = require('../routes/notifications');

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
  console.log('API routes initialized successfully');
};

module.exports = { mountRoutes };
