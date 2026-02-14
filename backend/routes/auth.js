const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const User = require('../models/UserModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/authMiddleware');
const { generateOTP, verifyOTP, sendOTPEmail, isEmailVerified, removeVerifiedEmail, markEmailAsVerified, sendPasswordResetEmail } = require('../services/otpService');
const otpGenerator = require('otp-generator');
const logger = require('../config/logger');
require('dotenv').config();

// Route-specific rate limiters (stricter than global API limit)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts from this IP. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests from this IP. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests from this IP. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for login attempts (per email+IP)
const loginAttempts = new Map();

// Cleanup expired login attempts every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.resetTime) {
      loginAttempts.delete(key);
    }
  }
}, 15 * 60 * 1000);

// Helper function to track login attempts
function updateLoginAttempts(key, success) {
  const now = Date.now();
  const data = loginAttempts.get(key) || { 
    attempts: 0, 
    resetTime: now + 15 * 60 * 1000, // Reset after 15 minutes
    blocked: false
  };
  
  if (success) {
    // On successful login, reset attempts
    loginAttempts.delete(key);
    return;
  }
  
  // Increment failed attempts
  data.attempts += 1;
  
  // Block after 5 failed attempts
  if (data.attempts >= 5) {
    data.blocked = true;
    data.resetTime = now + 15 * 60 * 1000; // Block for 15 minutes
  }
  
  loginAttempts.set(key, data);
}

// Send OTP for registration
router.post('/send-otp', sendOtpLimiter, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      logger.info('Received send-otp request for email: ' + (req.body?.email ? '(provided)' : '(missing)'));
    }
    const { email } = req.body;
    
    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Please provide a valid email address',
        field: 'email'
      });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        redirect: '/login'
      });
    }
    
    // Generate OTP
    let otp;
    try {
      otp = generateOTP(email);
      logger.info('OTP generated successfully for ' + email);
    } catch (otpError) {
      logger.error('Failed to generate OTP: ' + (otpError && otpError.message));
      return res.status(429).json({ 
        error: otpError.message || 'Rate limit exceeded for OTP generation'
      });
    }
    
    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp);
    
    if (!emailResult.success) {
      logger.error('Failed to send OTP email: ' + (emailResult && (emailResult.message || String(emailResult))));
      
      // Return appropriate error based on the issue
      if (emailResult.transportError === 'INVALID_EMAIL') {
        return res.status(400).json({ 
          error: 'The email address you provided appears to be invalid',
          field: 'email'
        });
      } else if (emailResult.transportError === 'EENVELOPE' || emailResult.transportError === 'ERECIPIENT') {
        return res.status(400).json({ 
          error: 'The email address does not exist or cannot receive emails',
          field: 'email'
        });
      } else if (emailResult.transportError === 'EAUTH' || emailResult.transportError === 'NO_SENDGRID_KEY' || emailResult.transportError === 'NO_CREDENTIALS') {
        return res.status(500).json({
          error: emailResult.error || 'Server email configuration error. Please try again later or contact support.',
          details: process.env.NODE_ENV === 'development' ? emailResult.details : undefined
        });
      } else {
        return res.status(500).json({
          error: emailResult.error || 'Failed to send OTP email. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? emailResult.details : undefined
        });
      }
    }

    res.json({ 
      message: 'OTP sent successfully',
      email
    });
    
  } catch (error) {
    logger.error('Send OTP error: ' + (error && error.message));
    res.status(500).json({ 
      error: 'Failed to send OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      logger.info('Verify OTP request received for email: ' + (req.body?.email ? '(provided)' : '(missing)'));
    }
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required',
        requiredFields: ['email', 'otp']
      });
    }
    
    const verification = verifyOTP(email, otp);
    
    if (verification.valid) {
      // Mark email as verified
      markEmailAsVerified(email);
      
      return res.status(200).json({ 
        success: true,
        message: verification.message
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: verification.message
      });
    }
  } catch (error) {
    logger.error('OTP verification error: ' + (error && error.message));
    return res.status(500).json({ 
      error: 'OTP verification failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    logger.info('Login attempt received');

    const { email, password } = req.body;
    if (process.env.NODE_ENV === 'development') {
      logger.info('Login handler started for email: ' + (email ? '(provided)' : '(missing)'));
    }

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password presence
    if (!password || password.trim().length < 1) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Implement rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const loginKey = `${email.toLowerCase()}:${clientIP}`;
    const now = Date.now();
    
    // Check if this IP+email combo is already blocked
    const attemptData = loginAttempts.get(loginKey);
    if (attemptData && attemptData.blocked && now < attemptData.resetTime) {
      const waitMinutes = Math.ceil((attemptData.resetTime - now) / (60 * 1000));
      return res.status(429).json({ 
        error: `Too many failed login attempts. Please try again in ${waitMinutes} minutes.`
      });
    }

    // Find user by email - use case insensitive search
    const user = await User.findByEmail(email.trim().toLowerCase());

    // Add small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));

    if (!user) {
      // Update failed attempts for this IP and email combination
      updateLoginAttempts(loginKey, false);
      logger.info('Login failed: user not found for email');
      return res.status(401).json({
        error: 'This email is not registered. Please register as a new user.',
        code: 'EMAIL_NOT_REGISTERED'
      });
    }

    // Log debugging info
    if (process.env.NODE_ENV === 'development') {
      logger.info('User found for login, password field exists: ' + !!user.password);
    }

    // Verify password
    let isMatch = false;
    try {
      if (!user.password) {
        logger.error('Password field missing for user');
        throw new Error('Password field is missing from user record');
      }
      isMatch = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      logger.error('Password comparison error: ' + (bcryptError && bcryptError.message));
      // Update failed attempts counter
      updateLoginAttempts(loginKey, false);
      return res.status(500).json({ error: 'Authentication error', details: 'Error verifying credentials' });
    }
    
    if (!isMatch) {
      // Update failed attempts counter
      updateLoginAttempts(loginKey, false);
      
      // Log suspicious activity if multiple failed attempts
      const updatedAttemptData = loginAttempts.get(loginKey);
      if (updatedAttemptData && updatedAttemptData.attempts >= 3) {
        logger.warn('Multiple failed login attempts: attempts=' + (updatedAttemptData && updatedAttemptData.attempts) + ', ip=' + (clientIP || ''));
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('Login failed: incorrect password for email');
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    updateLoginAttempts(loginKey, true);

    // Generate JWT (use same expiry as register/refresh)
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn, algorithm: 'HS256' }
    );

    // Compute expiry time for client (for token refresh flow)
    const expiry = new Date();
    const expirySeconds = typeof expiresIn === 'string' && expiresIn.endsWith('d')
      ? parseInt(expiresIn, 10) * 24 * 60 * 60
      : typeof expiresIn === 'string' && expiresIn.endsWith('h')
      ? parseInt(expiresIn, 10) * 60 * 60
      : 24 * 60 * 60;
    expiry.setSeconds(expiry.getSeconds() + expirySeconds);

    // Optional: issue refresh token when JWT_REFRESH_SECRET is set (rotation support)
    let refreshToken = null;
    let refreshExpires = null;
    if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_EXPIRES_IN) {
      const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
      refreshToken = jwt.sign(
        { id: user._id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: refreshExpiresIn, algorithm: 'HS256' }
      );
      const refExpiry = new Date();
      const refSeconds = typeof refreshExpiresIn === 'string' && refreshExpiresIn.endsWith('d')
        ? parseInt(refreshExpiresIn, 10) * 24 * 60 * 60
        : typeof refreshExpiresIn === 'string' && refreshExpiresIn.endsWith('h')
        ? parseInt(refreshExpiresIn, 10) * 60 * 60
        : 7 * 24 * 60 * 60;
      refExpiry.setSeconds(refExpiry.getSeconds() + refSeconds);
      refreshExpires = refExpiry.toISOString();
    }

    logger.info('Login successful for user');
    
    // Send response (include expires and optional refreshToken for rotation)
    const payload = {
      message: 'Login successful',
      token,
      expires: expiry.toISOString(),
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    };
    if (refreshToken) {
      payload.refreshToken = refreshToken;
      payload.refreshExpires = refreshExpires;
    }
    res.status(200).json(payload);
  } catch (error) {
    // Extract email from request body first
    const { email } = req.body;
    logger.info('Entering login catch block');
    logger.error('Login error: ' + (error && error.message));
    
    res.status(500).json({ 
      error: 'An error occurred during login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// User registration
router.post('/register', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      logger.info('Register request received for email: ' + (req.body?.email ? '(provided)' : '(missing)'));
    }
    const { fullName, email, password } = req.body;
    
    // Validate all required fields
    if (!fullName || !email || !password) {
      if (process.env.NODE_ENV === 'development') {
        logger.info('Missing required fields: fullName=' + !!fullName + ', email=' + !!email + ', password=' + !!password);
      }
      
      return res.status(400).json({ 
        error: 'All fields are required',
        requiredFields: ['fullName', 'email', 'password']
      });
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        field: 'email'
      });
    }
    
    // Enhanced password validation (min 8 chars, require mix of types)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character',
        field: 'password'
      });
    }
    
    // Verify full name format (letters and spaces only)
    if (!/^[A-Za-z ]+$/.test(fullName)) {
      return res.status(400).json({ 
        error: 'Full name can only contain letters and spaces',
        field: 'fullName'
      });
    }
    
    // Check if the email has been verified with OTP
    const isVerified = isEmailVerified(email);
    logger.info('Email verification status: ' + (isVerified ? 'Verified' : 'Not verified'));
    
    if (!isVerified) {
      logger.info('Verification failed, checking verified emails list');
      
      return res.status(400).json({ 
        error: 'Email verification required. Please verify your email with OTP first.',
        field: 'email',
        redirect: '/register'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Email already registered',
        redirect: '/login',
        field: 'email'
      });
    }
    
    // Hash password with increased work factor (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user'
    });
    
    // Remove email from verified list now that it's been used
    removeVerifiedEmail(email);
    
    // Log user creation for audit purposes
    logger.info('New user registered: id=' + (user && user._id));
    
    // Create token
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        fullName: user.fullName,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn, algorithm: 'HS256' }
    );
    
    const expiry = new Date();
    const expirySeconds = typeof expiresIn === 'string' && expiresIn.endsWith('d')
      ? parseInt(expiresIn) * 24 * 60 * 60 
      : typeof expiresIn === 'string' && expiresIn.endsWith('h')
      ? parseInt(expiresIn) * 60 * 60
      : 24 * 60 * 60;
    expiry.setSeconds(expiry.getSeconds() + expirySeconds);

    // Optional: issue refresh token when JWT_REFRESH_SECRET is set
    let refreshToken = null;
    let refreshExpires = null;
    if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_EXPIRES_IN) {
      const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
      refreshToken = jwt.sign(
        { id: user._id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: refreshExpiresIn, algorithm: 'HS256' }
      );
      const refExpiry = new Date();
      const refSeconds = typeof refreshExpiresIn === 'string' && refreshExpiresIn.endsWith('d')
        ? parseInt(refreshExpiresIn, 10) * 24 * 60 * 60
        : typeof refreshExpiresIn === 'string' && refreshExpiresIn.endsWith('h')
        ? parseInt(refreshExpiresIn, 10) * 60 * 60
        : 7 * 24 * 60 * 60;
      refExpiry.setSeconds(refExpiry.getSeconds() + refSeconds);
      refreshExpires = refExpiry.toISOString();
    }
    
    const payload = {
      token,
      expires: expiry.toISOString(),
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      message: 'Registration successful'
    };
    if (refreshToken) {
      payload.refreshToken = refreshToken;
      payload.refreshExpires = refreshExpires;
    }
    res.status(201).json(payload);
    
  } catch (error) {
    logger.error('Registration error: ' + (error && error.message));
    res.status(500).json({ 
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// In /me route
router.get('/me', authMiddleware, async (req, res) => {
try {
// Add proper error handling for missing user
if (!req.user?.id) {
return res.status(401).json({ error: 'Invalid authentication' });
}

const user = await User.findById(req.user.id).select('_id fullName email role createdAt');

if (!user) {
return res.status(404).json({ error: 'User not found' });
}

res.json(user);
} catch (error) {
logger.error('Error in /me route: ' + (error && error.message));
res.status(500).json({ error: 'Failed to fetch user info', details: error.message });
}
});

/**
 * Helper: issue access token and optional refresh token for a user
 */
function issueTokens(user) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  const token = jwt.sign(
    { id: user._id, role: user.role, fullName: user.fullName, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn, algorithm: 'HS256' }
  );
  const expiry = new Date();
  const expirySeconds = typeof expiresIn === 'string' && expiresIn.endsWith('d')
    ? parseInt(expiresIn, 10) * 24 * 60 * 60
    : typeof expiresIn === 'string' && expiresIn.endsWith('h')
    ? parseInt(expiresIn, 10) * 60 * 60
    : 24 * 60 * 60;
  expiry.setSeconds(expiry.getSeconds() + expirySeconds);

  const payload = {
    token,
    expires: expiry.toISOString(),
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
  };

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_EXPIRES_IN) {
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
    payload.refreshToken = jwt.sign(
      { id: user._id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: refreshExpiresIn, algorithm: 'HS256' }
    );
    const refExpiry = new Date();
    const refSeconds = typeof refreshExpiresIn === 'string' && refreshExpiresIn.endsWith('d')
      ? parseInt(refreshExpiresIn, 10) * 24 * 60 * 60
      : typeof refreshExpiresIn === 'string' && refreshExpiresIn.endsWith('h')
      ? parseInt(refreshExpiresIn, 10) * 60 * 60
      : 7 * 24 * 60 * 60;
    refExpiry.setSeconds(refExpiry.getSeconds() + refSeconds);
    payload.refreshExpires = refExpiry.toISOString();
  }
  return payload;
}

/**
 * Refresh token endpoint
 * - If body.refreshToken and JWT_REFRESH_SECRET: verify refresh token and issue new access (and new refresh).
 * - Else if Authorization Bearer: verify access token (allow expired) and issue new access (and optional refresh).
 */
router.post('/refresh-token', async (req, res) => {
  try {
    let user = null;

    // 1) Refresh token in body (when JWT_REFRESH_SECRET is set)
    const refreshTokenFromBody = req.body?.refreshToken;
    if (refreshTokenFromBody && process.env.JWT_REFRESH_SECRET) {
      try {
        const decoded = jwt.verify(refreshTokenFromBody, process.env.JWT_REFRESH_SECRET, {
          algorithms: ['HS256']
        });
        if (decoded.type === 'refresh' && decoded.id) {
          user = await User.findById(decoded.id);
        }
      } catch (e) {
        return res.status(401).json({
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
    }

    // 2) Fallback: Bearer access token (allow expired so client can refresh)
    if (!user) {
      const authHeader = req.headers['authorization'];
      const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (bearer) {
        try {
          const decoded = jwt.verify(bearer, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            ignoreExpiration: true
          });
          if (decoded.id) {
            user = await User.findById(decoded.id);
          }
        } catch (e) {
          return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Refresh token or valid access token required',
        code: 'AUTH_REQUIRED'
      });
    }

    const payload = issueTokens(user);
    logger.info('Token refreshed: userId=' + (user && user._id));
    return res.json(payload);
  } catch (error) {
    logger.error('Token refresh error: ' + (error && error.message));
    return res.status(500).json({
      error: 'Failed to refresh token',
      code: 'REFRESH_ERROR'
    });
  }
});

// Forgot Password - Request password reset
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    
    // Find user by email
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (!user) {
      // Don't reveal that the user does not exist for security reasons
      return res.status(200).json({ message: 'If your email is registered, you will receive a password reset link shortly.' });
    }
    
    // Generate a 6-digit numeric OTP for password reset
    const otp = otpGenerator.generate(6, { 
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false
    });
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('Generated OTP for password reset');
    }
    
    // Store hashed OTP and expiry in the user document (never store plain OTP)
    const hashedOTP = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    user.resetPasswordToken = hashedOTP;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();
    
    // Send OTP via email
    const emailResult = await sendPasswordResetEmail(email, otp);
    
    if (!emailResult.success) {
      logger.error('Failed to send password reset email: ' + (emailResult && (emailResult.message || String(emailResult))));
      
      // Return appropriate error based on the issue
      if (emailResult.transportError === 'INVALID_EMAIL') {
        return res.status(400).json({ 
          error: 'The email address you provided appears to be invalid'
        });
      } else if (emailResult.transportError === 'EENVELOPE' || emailResult.transportError === 'ERECIPIENT') {
        return res.status(400).json({ 
          error: 'The email address does not exist or cannot receive emails'
        });
      } else if (emailResult.transportError === 'EAUTH' || emailResult.transportError === 'NO_SENDGRID_KEY' || emailResult.transportError === 'NO_CREDENTIALS') {
        return res.status(500).json({
          error: emailResult.error || 'Server email configuration error. Please try again later or contact support.'
        });
      } else {
        return res.status(500).json({
          error: 'Failed to send password reset email. Please try again later.',
          details: emailResult.error
        });
      }
    }

    res.status(200).json({ 
      message: 'Password reset instructions sent to your email',
      email 
    });
    
  } catch (error) {
    logger.error('Forgot password error: ' + (error && error.message));
    res.status(500).json({ 
      error: 'Failed to process password reset request',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Verify Reset Password OTP
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('Verify reset OTP request received for email');
    }
    
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required',
        requiredFields: ['email', 'otp']
      });
    }
    
    // Find user by email first - add select to ensure we get the reset fields
    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+resetPasswordToken +resetPasswordExpires');
    
    if (!user) {
      logger.info('User not found for email (verify reset OTP)');
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email address'
      });
    }
    
    // Check if token exists
    if (!user.resetPasswordToken) {
      return res.status(400).json({ 
        success: false,
        error: 'No reset token found - please request a new OTP'
      });
    }
    
    // Check if token has expired
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'OTP has expired - please request a new OTP'
      });
    }
    
    // Compare hashed OTP (stored token is SHA-256 hash of the OTP)
    const hashedInputOTP = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    if (user.resetPasswordToken !== hashedInputOTP) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid OTP - please check and try again'
      });
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'OTP verified successfully'
    });
    
  } catch (error) {
    logger.error('Reset OTP verification error: ' + (error && error.message));
    return res.status(500).json({ 
      error: 'OTP verification failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reset Password - Set new password after OTP verification
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('Reset password request received');
    }
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        error: 'All fields are required',
        requiredFields: ['email', 'otp', 'newPassword']
      });
    }
    
    // Check password strength (same as register: 8+ chars, upper, lower, number, special)
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
      });
    }

    // Find user by email first
    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+resetPasswordToken +resetPasswordExpires');
    
    if (!user) {
      logger.info('User not found for email (verify reset OTP)');
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Check if token exists
    if (!user.resetPasswordToken) {
      return res.status(400).json({ error: 'No reset token found - please request a new OTP' });
    }
    
    // Check if token has expired
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: 'OTP has expired - please request a new OTP' });
    }
    
    // Compare hashed OTP (stored token is SHA-256 hash of the OTP)
    const hashedInputOTP = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    if (user.resetPasswordToken !== hashedInputOTP) {
      return res.status(400).json({ error: 'Invalid OTP - please check and try again' });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    logger.info('Password hashed successfully');
    
    // Update user with new password and remove reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    logger.info('Password reset successful for user');
    
    res.status(200).json({ message: 'Password has been reset successfully' });
    
  } catch (error) {
    logger.error('Reset password error: ' + (error && error.message));
    res.status(500).json({ 
      error: 'Failed to reset password',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;