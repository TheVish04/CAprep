const mongoose = require('mongoose');
const logger = require('./logger');
require('dotenv').config();

// Connect to MongoDB with retry logic
const connectDB = async (retryCount = 5, delay = 5000) => {
  try {
    // Add connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 30000, // Increased timeout for server selection
      socketTimeoutMS: 60000, // Increased socket timeout
      connectTimeoutMS: 30000, // Add explicit connection timeout
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10, // Limit connection pool size
      minPoolSize: 2 // Maintain minimum connections
    };

    // Add connection events before connecting
    mongoose.connection.on('error', err => {
      logger.error('MongoDB connection error: ' + (err && err.message));
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

    // Attempt database connection
    logger.info('Attempting MongoDB connection to: ' + (process.env.MONGODB_URI ? (process.env.MONGODB_URI.split('@')[1] || '[URI hidden]') : '[URI hidden]'));
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    logger.info('MongoDB Connected: ' + conn.connection.host);
    
    return conn;
  } catch (error) {
    logger.error('Error connecting to MongoDB: ' + (error && error.message));
    
    // Implement retry logic
    if (retryCount > 0) {
      logger.info('Retrying connection in ' + (delay / 1000) + ' seconds... (' + retryCount + ' attempts remaining)');
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retryCount - 1, delay);
    } else {
      logger.error('Failed to connect to MongoDB after multiple attempts. Exiting process.');
      process.exit(1);
    }
  }
};

module.exports = connectDB;