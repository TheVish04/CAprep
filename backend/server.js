const express = require('express');
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/database');
const User = require('./models/UserModel');
const Question = require('./models/QuestionModel');
const Resource = require('./models/ResourceModel');
const Discussion = require('./models/DiscussionModel');
const { authMiddleware, adminMiddleware } = require('./middleware/authMiddleware');
const { checkAndCreateAdmin } = require('./bootstrap/adminBootstrap');
const { mountRoutes } = require('./bootstrap/routes');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { clearAllCache } = require('./middleware/cacheMiddleware');
const logger = require('./config/logger');

const app = express();
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(xss());
app.use(mongoSanitize()); // Prevent MongoDB operator injection

// Global rate limiter - max 200 requests per IP per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// Middleware - increase all body parser limits to 20MB
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Get allowed origins from environment variable
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://caprep.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
logger.info(`Configured CORS allowed origins: ${allowedOrigins.join(', ')}`);

// CORS middleware configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'x-skip-cache'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Add explicit CORS headers for all routes to ensure they're set
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow any of the specified origins that sent the request
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires, x-skip-cache');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (process.env.NODE_ENV === 'development') {
    logger.info(`[CORS] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Handle OPTIONS requests explicitly
app.options('*', cors());

// Request logging (development only - avoid logging body/headers in production)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
    next();
  });
}

// Initialize database and models before setting up routes
const initializeDatabase = async () => {
  try {
    // Ensure database directory exists (for verified_emails.json and other file persistence)
    const databaseDir = path.join(__dirname, 'database');
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
      logger.info('Created database directory for file persistence');
    }

    // Connect to MongoDB
    const conn = await connectDB();
    logger.info('Database connection established successfully');

    // Verify models (with more detailed logging)
    let modelsValid = true;

    // Verify User model
    if (!User) {
      logger.error('User model is undefined. Import path or file issue: ' + JSON.stringify({
        filePath: './models/UserModel',
        cwd: process.cwd(),
      }));
      modelsValid = false;
    } else if (typeof User.findOne !== 'function') {
      logger.error('User model lacks findOne method');
      modelsValid = false;
    } else {
      logger.info('User model loaded successfully');
    }

    // Verify Question model
    if (!Question) {
      logger.error('Question model is undefined. Import path or file issue: ' + JSON.stringify({ filePath: './models/QuestionModel', cwd: process.cwd() }));
      modelsValid = false;
    } else if (typeof Question.findOne !== 'function') {
      logger.error('Question model lacks findOne method');
      modelsValid = false;
    } else {
      logger.info('Question model loaded successfully');
    }
    
    // Verify Resource model
    if (!Resource) {
      logger.error('Resource model is undefined. Import path or file issue: ' + JSON.stringify({ filePath: './models/ResourceModel', cwd: process.cwd() }));
      modelsValid = false;
    } else if (typeof Resource.findOne !== 'function') {
      logger.error('Resource model lacks findOne method');
      modelsValid = false;
    } else {
      logger.info('Resource model loaded successfully');
    }

    // Verify Discussion model
    if (!Discussion) {
      logger.error('Discussion model is undefined. Import path or file issue: ' + JSON.stringify({ filePath: './models/DiscussionModel', cwd: process.cwd() }));
      modelsValid = false;
    } else if (typeof Discussion.findOne !== 'function') {
      logger.error('Discussion model lacks findOne method');
      modelsValid = false;
    } else {
      logger.info('Discussion model loaded successfully');
    }

    if (!modelsValid) {
      throw new Error('One or more required models failed to initialize');
    }

    // Check if an admin user exists, create one if not
    try {
      await checkAndCreateAdmin();
    } catch (adminError) {
      logger.error('Admin creation failed but server initialization will continue: ' + adminError.message);
      // Continue with server initialization despite admin creation failure
    }

    // Log total number of users for debugging
    try {
      const userCount = await User.countDocuments();
      logger.info(`Total users in database: ${userCount}`);
    } catch (err) {
      logger.error('Error counting users: ' + err.message);
    }

    // Log total number of questions for debugging
    try {
      const questionCount = await Question.countDocuments();
      logger.info(`Total questions in database: ${questionCount}`);
    } catch (err) {
      logger.error('Error counting questions: ' + err.message);
    }
    
    // Log total number of resources for debugging
    try {
      const resourceCount = await Resource.countDocuments();
      logger.info(`Total resources in database: ${resourceCount}`);
    } catch (err) {
      logger.error('Error counting resources: ' + err.message);
    }

    logger.info('Setting up API routes...');
    mountRoutes(app);

    return true; // Signal successful initialization
  } catch (err) {
    logger.error('Error initializing database or models: ' + err.message);
    
    // Continue server initialization if possible
    if (mongoose.connection.readyState === 1) {
      logger.warn('Attempting to continue server initialization despite errors');
      mountRoutes(app);
      return true;
    }
    
    return false; // Signal failed initialization
  }
};

// Example protected admin route
app.get('/api/admin', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ 
    message: 'Welcome to the admin panel', 
    user: req.user.fullName, 
    email: req.user.email,
    role: req.user.role 
  });
});

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    dbConnected: mongoose.connection.readyState === 1, // 1 = connected
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
  res.status(200).json(health);
});

// Add an endpoint to clear all caches (admin only)
app.post('/api/admin/clear-cache', authMiddleware, adminMiddleware, (req, res) => {
  try {
    clearAllCache();
    res.status(200).json({ success: true, message: 'All caches cleared successfully' });
  } catch (error) {
    logger.error('Error clearing cache: ' + error.message);
    res.status(500).json({ success: false, error: 'Failed to clear cache' });
  }
});

// Server startup function
const startServer = async () => {
  try {
    const PORT = process.env.PORT || 5000;

    // Initialize database with error handling
    let dbInitialized = false;
    try {
      dbInitialized = await initializeDatabase();
      logger.info(`Database initialization successful: ${dbInitialized}`);
    } catch (dbError) {
      logger.error(`Database initialization error: ${dbError.message}`);
      logger.warn('Server will continue without full database functionality');
    }

    // Define fallback routes if database initialization fails
    if (!dbInitialized) {
      app.get('/', (req, res) => {
        res.status(200).json({ 
          message: 'Server is running, but database connection failed. Some features may not work properly.',
          status: 'partial'
        });
      });
    }

    // Error handling middleware
    app.use((err, req, res, next) => {
      logger.error(err.stack);
      res.status(500).json({ 
        error: 'Server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' 
      });
    });

    // 404 middleware
    app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
    
    // Start the server
    await new Promise(resolve => {
      const server = app.listen(PORT, () => {
        logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        resolve();
      });
      
      // Handle server errors
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${PORT} is already in use`);
        } else {
          logger.error(`Server error: ${error.message}`);
        }
        process.exit(1);
      });
    });
    
  } catch (error) {
    logger.error(`UNHANDLED REJECTION! Shutting down... ${error.message}`);
    process.exit(1);
  }
};

// Start the server
startServer();