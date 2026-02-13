const express = require('express');
const connectDB = require('./config/database');
const User = require('./models/UserModel');
const Question = require('./models/QuestionModel');
const Resource = require('./models/ResourceModel');
const Discussion = require('./models/DiscussionModel');
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const resourceRoutes = require('./routes/resources');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const discussionRoutes = require('./routes/discussions');
const { authMiddleware, adminMiddleware } = require('./middleware/authMiddleware');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const aiQuizRoutes = require('./routes/aiQuiz');
const dashboardRoutes = require('./routes/dashboard');
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
  
  // Log CORS information for debugging
  console.log(`[CORS] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Handle OPTIONS requests explicitly
app.options('*', cors());

// Remove all the custom CORS handling that might be causing conflicts
// and replace with a simple, focused middleware for debugging CORS issues
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// Add request logging middleware for debugging
app.use((req, res, next) => {
  if (req.path === '/api/auth/register') {
    console.log('💫 Register request received:');
    console.log('💫 Headers:', req.headers);
    console.log('💫 Body:', req.body);
  }
  next();
});

// Initialize database and models before setting up routes
const initializeDatabase = async () => {
  try {
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
    // Set up routes after successful initialization
    app.use('/api/auth', authRoutes);
    app.use('/api/questions', questionRoutes);
    // Payment routes removed
    app.use('/api/resources', resourceRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/ai-quiz', aiQuizRoutes);
    app.use('/api/discussions', discussionRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    
    // Add announcements routes
    app.use('/api/announcements', authMiddleware, async (req, res) => {
      try {
        const Announcement = require('./models/AnnouncementModel');
        const announcements = await Announcement.find({
          validUntil: { $gte: new Date() }
        })
        .sort({ priority: -1, createdAt: -1 })
        .limit(req.query.limit ? parseInt(req.query.limit) : 10)
        .populate('createdBy', 'fullName');
        
        res.status(200).json({
          success: true,
          data: announcements
        });
      } catch (error) {
        console.error('Announcements retrieval error:', error);
        res.status(500).json({ success: false, message: 'Error retrieving announcements', error: error.message });
      }
    });
    
    // Uploads are now handled directly through Cloudinary
    // No need to create local upload directories
    
    // All file downloads are now handled via Cloudinary URLs
    // No need for custom download routes
    
    console.log('API routes initialized successfully');

    return true; // Signal successful initialization
  } catch (err) {
    console.error('Error initializing database or models:', {
      message: err.message,
      stack: err.stack,
    });
    
    // Continue server initialization if possible
    if (mongoose.connection.readyState === 1) {
      console.warn('Attempting to continue server initialization despite errors');
      app.use('/api/auth', authRoutes);
      app.use('/api/questions', questionRoutes);
      // Payment routes removed
      app.use('/api/resources', resourceRoutes);
      app.use('/api/users', userRoutes);
      app.use('/api/admin', adminRoutes);
      app.use('/api/ai-quiz', aiQuizRoutes);
      app.use('/api/discussions', discussionRoutes);
      app.use('/api/dashboard', dashboardRoutes);
      return true;
    }
    
    return false; // Signal failed initialization
  }
};

// Separate function to check and create admin user
const checkAndCreateAdmin = async () => {
  try {
    console.log('Checking for existing admin users...');
    
    // Handle possible model initialization issues
    if (!User || typeof User.countDocuments !== 'function') {
      throw new Error('User model not properly initialized');
    }
    
    // Check database connection first
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Cannot create admin user: Database not connected');
    }
    
    // Count existing admins with retry logic
    let adminCount = 0;
    let retries = 3;
    
    while (retries > 0) {
      try {
        adminCount = await User.countDocuments({ role: 'admin' });
        console.log(`Found ${adminCount} admin users in database`);
        break;
      } catch (err) {
        retries--;
        console.error(`Error counting admin users (retries left: ${retries}):`, err.message);
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }

    if (adminCount === 0) {
      // Validate admin credentials from env
      const adminFullName = process.env.ADMIN_FULL_NAME || 'Admin User';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        throw new Error('Invalid admin email format');
      }
      if (!adminPassword || adminPassword.length < 8) {
        throw new Error('Admin password must be at least 8 characters long');
      }

      console.log('No admin user found. Creating default admin account...');
      
      // Hash password with proper error handling
      let hashedPassword;
      try {
        hashedPassword = await bcrypt.hash(adminPassword, 12);
      } catch (err) {
        console.error('Failed to hash admin password:', err);
        throw new Error('Admin creation failed: Password hashing error');
      }
      
      // Create the admin user with retry logic
      let admin = null;
      retries = 3;
      
      while (retries > 0 && !admin) {
        try {
          admin = await User.create({
            fullName: adminFullName,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin'
          });
          break;
        } catch (err) {
          retries--;
          if (err.code === 11000) {
            // Duplicate key error - admin might exist but query failed earlier
            console.warn('Admin user appears to exist (duplicate key error). Rechecking...');
            const existingAdmin = await User.findOne({ email: adminEmail });
            if (existingAdmin) {
              console.log('Admin user found on recheck:', {
                fullName: existingAdmin.fullName,
                email: existingAdmin.email,
                role: existingAdmin.role
              });
              return; // Exit function if admin exists
            }
          }
          
          console.error(`Failed to create admin user (retries left: ${retries}):`, err.message);
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }
      
      if (admin) {
        console.log('✅ Admin user created successfully:', {
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role
        });
      } else {
        throw new Error('Failed to create admin user after multiple attempts');
      }
    } else {
      console.log('Admin user already exists, skipping creation.');
      try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
          console.log('Existing admin details:', {
            fullName: existingAdmin.fullName,
            email: existingAdmin.email,
            role: existingAdmin.role,
          });
        } else {
          console.warn('Admin count is non-zero but findOne returned no results. This is unexpected.');
        }
      } catch (err) {
        console.error('Error fetching existing admin details:', err.message);
        // Don't throw here, as admin exists and this is just informational
      }
    }
  } catch (error) {
    console.error('⚠️ Admin initialization error:', error.message);
    console.error(error.stack);
    // Don't throw the error, but log that server will continue without admin
    console.warn('Server continuing without admin initialization. Admin features may not work correctly.');
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

// Export the app for testing
module.exports = app;