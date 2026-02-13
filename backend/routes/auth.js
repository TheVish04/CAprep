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
const nodemailer = require('nodemailer');
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
      console.log('Received send-otp request for email:', req.body?.email ? '(provided)' : '(missing)');
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
      console.log(`OTP generated successfully for ${email}`);
    } catch (otpError) {
      console.error('Failed to generate OTP:', otpError);
      return res.status(429).json({ 
        error: otpError.message || 'Rate limit exceeded for OTP generation'
      });
    }
    
    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult);
      
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
    console.error('Send OTP error:', {
      message: error.message, 
      stack: error.stack
    });
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
      console.log('Verify OTP request received for email:', req.body?.email ? '(provided)' : '(missing)');
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
    console.error('OTP verification error:', error);
    return res.status(500).json({ 
      error: 'OTP verification failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    console.log('Login attempt received:', {
      origin: req.headers.origin,
      method: req.method,
      contentType: req.headers['content-type'],
      hasBody: !!req.body,
      emailProvided: !!req.body?.email
    });

    const { email, password } = req.body;
    if (process.env.NODE_ENV === 'development') {
      console.log('Login handler started for email:', email ? '(provided)' : '(missing)');
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
      console.log(`Login failed: user not found for email ${email}`);
      return res.status(401).json({
        error: 'This email is not registered. Please register as a new user.',
        code: 'EMAIL_NOT_REGISTERED'
      });
    }

    // Log debugging info
    if (process.env.NODE_ENV === 'development') {
      console.log('User found for login, password field exists:', !!user.password);
    }

    // Verify password
    let isMatch = false;
    try {
      if (!user.password) {
        console.error(`Password field missing for user ${email}`);
        throw new Error('Password field is missing from user record');
      }
      isMatch = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      console.error(`Password comparison error for ${email}:`, bcryptError.message);
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
        console.warn('Multiple failed login attempts:', {
          email,
          ip: clientIP,
          attempts: updatedAttemptData.attempts,
          timestamp: new Date().toISOString()
        });
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Login failed: incorrect password for email');
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
      { expiresIn }
    );

    // Compute expiry time for client (for token refresh flow)
    const expiry = new Date();
    const expirySeconds = typeof expiresIn === 'string' && expiresIn.endsWith('d')
      ? parseInt(expiresIn, 10) * 24 * 60 * 60
      : typeof expiresIn === 'string' && expiresIn.endsWith('h')
      ? parseInt(expiresIn, 10) * 60 * 60
      : 24 * 60 * 60;
    expiry.setSeconds(expiry.getSeconds() + expirySeconds);

    console.log(`Login successful for user: ${email}`);
    
    // Send response (include expires for frontend token refresh)
    res.status(200).json({
      message: 'Login successful',
      token,
      expires: expiry.toISOString(),
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    // Extract email from request body first
    const { email } = req.body;
    console.log(`Entering login catch block for email: ${email || 'unknown'}`);
    
    console.error('Login error:', {
      message: error.message,
      stack: error.stack,
      email: email || 'unknown' });
    
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
      console.log('Register request received for email:', req.body?.email ? '(provided)' : '(missing)');
    }
    const { fullName, email, password } = req.body;
    
    // Validate all required fields
    if (!fullName || !email || !password) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Missing required fields:', { hasFullName: !!fullName, hasEmail: !!email, hasPassword: !!password });
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
    console.log(`Email verification status for ${email}: ${isVerified ? 'Verified' : 'Not verified'}`);
    
    if (!isVerified) {
      console.log(`Verification failed for ${email}. Checking verified emails list...`);
      
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
    console.log('New user registered:', {
      userId: user._id,
      email: email.toLowerCase(),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // Create token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        fullName: user.fullName,
        email: user.email
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
        algorithm: 'HS256'
      }
    );
    
    // Calculate expiry time for client
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const expiry = new Date();
    const expirySeconds = typeof expiresIn === 'string' && expiresIn.endsWith('d')
      ? parseInt(expiresIn) * 24 * 60 * 60 
      : typeof expiresIn === 'string' && expiresIn.endsWith('h')
      ? parseInt(expiresIn) * 60 * 60
      : 24 * 60 * 60; // Default 1 day
    
    expiry.setSeconds(expiry.getSeconds() + expirySeconds);
    
    // Return success with user data
    res.status(201).json({
      token,
      expires: expiry.toISOString(),
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      message: 'Registration successful'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
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
console.error('Error in /me route:', {
message: error.message,
stack: error.stack,
});
res.status(500).json({ error: 'Failed to fetch user info', details: error.message });
}
});

/**
 * Refresh token endpoint
 * Issues a new token if the current one is valid but approaching expiration
 */
router.post('/refresh-token', authMiddleware, async (req, res) => {
  try {
    // User is already authenticated via authMiddleware
    const userId = req.user.id;
    
    // Fetch latest user data to ensure it's current
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Create a new token
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        fullName: user.fullName,
        email: user.email
      },
      process.env.JWT_SECRET,
      { 
        expiresIn,
        algorithm: 'HS256'
      }
    );
    
    // Calculate expiry time for client
    const expiry = new Date();
    const expirySeconds = typeof expiresIn === 'string' && expiresIn.endsWith('d')
      ? parseInt(expiresIn) * 24 * 60 * 60
      : typeof expiresIn === 'string' && expiresIn.endsWith('h')
      ? parseInt(expiresIn) * 60 * 60
      : 24 * 60 * 60; // Default 1 day
    
    expiry.setSeconds(expiry.getSeconds() + expirySeconds);
    
    // Log token refresh for security auditing
    console.log('Token refreshed:', {
      userId: user._id,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // Return the new token and user information
    return res.json({
      token,
      expires: expiry.toISOString(),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
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
      console.log(`Generated OTP for password reset for email: ${email}`);
    }
    
    // Store hashed OTP and expiry in the user document (never store plain OTP)
    const hashedOTP = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    user.resetPasswordToken = hashedOTP;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();
    
    // Send OTP via email
    const emailResult = await sendPasswordResetEmail(email, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult);
      
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
    console.error('Forgot password error:', {
      message: error.message, 
      stack: error.stack
    });
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
      console.log('Verify reset OTP request received for email:', email);
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
      console.log(`User not found for email: ${email}`);
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
    console.error('Reset OTP verification error:', error);
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
      console.log('Reset password request received for email:', email);
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
      console.log(`User not found for email: ${email}`);
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
    console.log('Password hashed successfully');
    
    // Update user with new password and remove reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    console.log('Password reset successful for user:', email);
    
    res.status(200).json({ message: 'Password has been reset successfully' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test Email Service - For debugging only (development only)
router.post('/test-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production mode' });
  }
  try {
    const { email } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    console.log(`Test email request to: ${email}`);

    // Create a simple test email
    const testEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #0288d1;">CAprep - Test Email</h2>
        <p>This is a test email to verify that the email service is working correctly.</p>
        <p>If you received this email, it means our email delivery system is functioning properly.</p>
        <p>Time sent: ${new Date().toISOString()}</p>
        <p style="margin-top: 30px; font-size: 12px; color: #777;">This is an automated message for testing purposes only, please do not reply.</p>
      </div>
    `;

    // Create a transporter instance just for this test
    const testTransporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      debug: true
    });

    const mailOptions = {
      from: `"CAprep Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'CAprep Email Service Test',
      html: testEmailContent,
      priority: 'high'
    };

    const info = await testTransporter.sendMail(mailOptions);
    console.log(`Test email sent successfully to ${email}. Message ID: ${info.messageId}`);

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      }
    });
  } catch (error) {
    console.error('Test email error:', {
      message: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: {
        message: error.message,
        code: error.code,
        response: error.response || 'No response'
      }
    });
  }
});

// Debug route to check email configuration
router.get('/debug-email', async (req, res) => {
  // Only available in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production mode' });
  }
  
  try {
    // Mask email password for security
    const maskedPassword = process.env.EMAIL_PASSWORD ? 
      '*'.repeat(process.env.EMAIL_PASSWORD.length) : 'not set';
    
    res.json({
      email_config: {
        EMAIL_USER: process.env.EMAIL_USER || 'not set',
        EMAIL_PASSWORD_SET: !!process.env.EMAIL_PASSWORD,
        EMAIL_PASSWORD_LENGTH: process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.length : 0,
        EMAIL_PASSWORD_MASKED: maskedPassword
      },
      smtp_test: {
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'default'
      }
    });
  } catch (error) {
    console.error('Debug email error:', error);
    res.status(500).json({ error: 'Error getting email debug info' });
  }
});

module.exports = router;