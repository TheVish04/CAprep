const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {
  // Check for authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  // Verify token format and extract it
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token format should be: Bearer [token]' });
  }

  const token = parts[1];

  try {
    // Verify token with proper error handling
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'], // Explicitly specify algorithm
      maxAge: process.env.JWT_EXPIRES_IN || '1d' // Double check expiration
    });
    
    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ 
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach user object to request but remove sensitive data
    req.user = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    // Handle specific JWT errors with secure error messages
    if (error.name === 'JsonWebTokenError') {
      logger.error('JWT Error: ' + (error && error.message));
      return res.status(401).json({ 
        error: 'Invalid token', 
        code: 'INVALID_TOKEN' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token has expired', 
        code: 'TOKEN_EXPIRED' 
      });
    } else {
      logger.error('Token verification failed: ' + (error && error.message));
      return res.status(401).json({ 
        error: 'Authentication failed',
        code: 'AUTH_FAILED' 
      });
    }
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    // Log all admin access attempts for security monitoring
    logger.warn('Unauthorized admin access attempt: userId=' + (req.user && req.user.id) + ', path=' + (req.originalUrl || ''));
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
};

module.exports = { authMiddleware, adminMiddleware };