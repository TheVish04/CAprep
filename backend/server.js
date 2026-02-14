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
console.log('Configured CORS allowed origins:', allowedOrigins);

// CORS middleware configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from: ${origin}`);
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
    console.log(`[CORS] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
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
      console.log('Created database directory for file persistence');
    }

    // Connect to MongoDB
    const conn = await connectDB();
    console.log('Database connection established successfully');

    // Verify models (with more detailed logging)
    let modelsValid = true;

    // Verify User model
    if (!User) {
      console.error('User model is undefined. Import path or file issue:', {
        filePath: './models/UserModel',
        cwd: process.cwd(),
      });
      modelsValid = false;
    } else if (typeof User.findOne !== 'function') {
      console.error('User model lacks findOne method:', User);
      modelsValid = false;
    } else {
      console.log('User model loaded successfully');
    }

    // Verify Question model
    if (!Question) {
      console.error('Question model is undefined. Import path or file issue:', {
        filePath: './models/QuestionModel',
        cwd: process.cwd(),
      });
      modelsValid = false;
    } else if (typeof Question.findOne !== 'function') {
      console.error('Question model lacks findOne method:', Question);
      modelsValid = false;
    } else {
      console.log('Question model loaded successfully');
    }
    
    // Verify Resource model
    if (!Resource) {
      console.error('Resource model is undefined. Import path or file issue:', {
        filePath: './models/ResourceModel',
        cwd: process.cwd(),
      });
      modelsValid = false;
    } else if (typeof Resource.findOne !== 'function') {
      console.error('Resource model lacks findOne method:', Resource);
      modelsValid = false;
    } else {
      console.log('Resource model loaded successfully');
    }

    // Verify Discussion model
    if (!Discussion) {
      console.error('Discussion model is undefined. Import path or file issue:', {
        filePath: './models/DiscussionModel',
        cwd: process.cwd(),
      });
      modelsValid = false;
    } else if (typeof Discussion.findOne !== 'function') {
      console.error('Discussion model lacks findOne method:', Discussion);
      modelsValid = false;
    } else {
      console.log('Discussion model loaded successfully');
    }

    if (!modelsValid) {
      throw new Error('One or more required models failed to initialize');
    }

    // Check if an admin user exists, create one if not
    try {
      await checkAndCreateAdmin();
    } catch (adminError) {
      console.error('Admin creation failed but server initialization will continue:', adminError.message);
      // Continue with server initialization despite admin creation failure
    }

    // Log total number of users for debugging
    try {
      const userCount = await User.countDocuments();
      console.log(`Total users in database: ${userCount}`);
    } catch (err) {
      console.error('Error counting users:', err.message);
    }

    // Log total number of questions for debugging
    try {
      const questionCount = await Question.countDocuments();
      console.log(`Total questions in database: ${questionCount}`);
    } catch (err) {
      console.error('Error counting questions:', err.message);
    }
    
    // Log total number of resources for debugging
    try {
      const resourceCount = await Resource.countDocuments();
      console.log(`Total resources in database: ${resourceCount}`);
    } catch (err) {
      console.error('Error counting resources:', err.message);
    }

    console.log('Setting up API routes...');
    mountRoutes(app);

    return true; // Signal successful initialization
  } catch (err) {
    console.error('Error initializing database or models:', {
      message: err.message,
      stack: err.stack,
    });
    
    // Continue server initialization if possible
    if (mongoose.connection.readyState === 1) {
      console.warn('Attempting to continue server initialization despite errors');
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
    console.error('Error clearing cache:', error);
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
      console.log('Database initialization successful:', dbInitialized);
    } catch (dbError) {
      console.error('Database initialization error:', dbError.message);
      console.warn('Server will continue without full database functionality');
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
      console.error(err.stack);
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
        console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        resolve();
      });
      
      // Handle server errors
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use`);
        } else {
          console.error('Server error:', error);
        }
        process.exit(1);
      });
    });
    
  } catch (error) {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...', error);
    process.exit(1);
  }
};

// Start the server
startServer();