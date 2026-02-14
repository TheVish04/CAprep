const otpGenerator = require('otp-generator');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
require('dotenv').config();

// SendGrid: email API (no SMTP). Works with Vercel/Render serverless. Single Sender Verification = no DNS required.
// Get API key at sendgrid.com; verify one sender at Sender Authentication (Single Sender).
const useSendGrid = () => !!process.env.SENDGRID_API_KEY;
const getSendGridFrom = () =>
  process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || 'noreply@example.com';

if (useSendGrid()) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  logger.info('Email: Using SendGrid API (HTTP) - works with Vercel/Render');
  logger.info('SendGrid FROM: ' + getSendGridFrom());
}

// Path to store verified emails
const verifiedEmailsFilePath = path.join(__dirname, '../database/verified_emails.json');

// Enhanced in-memory OTP storage with rate limiting and cleanup
// For production, use Redis or a database
const otpStore = new Map();
const rateLimit = new Map(); // Store attempt counts per email
const verifiedEmails = new Map(); // Store verified emails

// Load verified emails from disk if exists
try {
  if (fs.existsSync(verifiedEmailsFilePath)) {
    const data = fs.readFileSync(verifiedEmailsFilePath, 'utf8');
    const parsed = JSON.parse(data);
    Object.entries(parsed).forEach(([email, timestamp]) => {
      verifiedEmails.set(email, timestamp);
    });
    logger.info('Loaded ' + verifiedEmails.size + ' verified emails from disk');
  } else {
    logger.info('No verified emails file found, starting with empty set');
    // Create directory if it doesn't exist
    const dir = path.dirname(verifiedEmailsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Initialize empty file
    fs.writeFileSync(verifiedEmailsFilePath, '{}', 'utf8');
  }
} catch (error) {
  logger.error('Error loading verified emails from disk: ' + (error && error.message));
}

// Function to save verified emails to disk
const saveVerifiedEmailsToDisk = () => {
  try {
    const data = {};
    verifiedEmails.forEach((timestamp, email) => {
      data[email] = timestamp;
    });
    fs.writeFileSync(verifiedEmailsFilePath, JSON.stringify(data, null, 2), 'utf8');
    logger.info('Saved ' + verifiedEmails.size + ' verified emails to disk');
  } catch (error) {
    logger.error('Error saving verified emails to disk: ' + (error && error.message));
  }
};

// Regularly clean up expired OTPs and verified emails to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean up expired OTPs
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
    }
  }
  
  // Clean up old verified emails (keep for 2 hours instead of 30 minutes)
  let modified = false;
  for (const [email, timestamp] of verifiedEmails.entries()) {
    if (now - timestamp > 2 * 60 * 60 * 1000) { // 2 hours
      verifiedEmails.delete(email);
      modified = true;
    }
  }
  
  // Save to disk if verified emails changed
  if (modified) {
    saveVerifiedEmailsToDisk();
  }
}, 60000); // Clean up every minute

// Send email via SendGrid API (transactional). No DNS required with Single Sender Verification.
const sendViaSendGrid = async (to, subject, html, text = '') => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return {
        success: false,
        error: 'Email service configuration error. SENDGRID_API_KEY is missing.',
        transportError: 'NO_SENDGRID_KEY'
      };
    }
    const from = getSendGridFrom();
    const msg = {
      to,
      from: from.includes('<') ? from : `CAprep Support <${from}>`,
      subject,
      html: html || `<p>${text}</p>`,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : '')
    };
    logger.info('SendGrid: Sending email to ' + to);
    const [response] = await sgMail.send(msg);
    if (response && response.statusCode >= 200 && response.statusCode < 300) {
      logger.info('SendGrid: Email sent successfully. Status: ' + (response && response.statusCode));
      return { success: true, messageId: response.headers?.['x-message-id'] };
    }
    return { success: true, messageId: null };
  } catch (err) {
    const body = err.response?.body || {};
    const message = body.errors?.[0]?.message || err.message || 'Failed to send email via SendGrid';
    logger.error('SendGrid error: ' + (message || '') + ' ' + (body ? JSON.stringify(body) : ''));
    return {
      success: false,
      error: message,
      transportError: 'SENDGRID_ERROR',
      details: process.env.NODE_ENV === 'development' ? (body.errors || err.message) : undefined
    };
  }
};

// Generate OTP and store it
const generateOTP = (email) => {
  // Check if rate limit exceeded (max 3 OTPs in 15 minutes)
  const now = Date.now();
  const recentAttempts = rateLimit.get(email) || [];
  
  // Remove attempts older than 15 minutes
  const recentValidAttempts = recentAttempts.filter(
    timestamp => now - timestamp < 15 * 60 * 1000
  );
  
  if (recentValidAttempts.length >= 3) {
    throw new Error('Rate limit exceeded. Please try again in 15 minutes.');
  }
  
  // Add current attempt and update rate limit
  recentValidAttempts.push(now);
  rateLimit.set(email, recentValidAttempts);
  
  // Generate a secure 6-digit OTP
  const otp = otpGenerator.generate(6, { 
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false
  });
  
  // Hash the OTP for storage (don't store in plain text)
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  
  // Store OTP with expiry time (increased to 15 minutes)
  otpStore.set(email, {
    hashedOTP,
    expiresAt: now + 15 * 60 * 1000, // 15 minutes (increased from 5)
    attempts: 0 // Track failed verification attempts
  });
  
  return otp;
};

// Verify OTP
const verifyOTP = (email, otp) => {
  const otpData = otpStore.get(email);
  
  if (!otpData) {
    return { valid: false, message: 'OTP not found. Please request a new OTP.' };
  }
  
  if (Date.now() > otpData.expiresAt) {
    otpStore.delete(email); // Clean up expired OTP
    return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
  }
  
  // Limit attempts to prevent brute force (max 5 attempts)
  if (otpData.attempts >= 5) {
    otpStore.delete(email); // Invalidate after too many attempts
    return { valid: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }
  
  // Hash the user-provided OTP to compare
  const hashedInputOTP = crypto.createHash('sha256').update(otp).digest('hex');
  
  if (otpData.hashedOTP !== hashedInputOTP) {
    // Increment failed attempts
    otpData.attempts += 1;
    otpStore.set(email, otpData);
    return { valid: false, message: 'Invalid OTP. Please try again.' };
  }
  
  // OTP is valid, clean up
  otpStore.delete(email);
  
  // Also remove from rate limit after successful verification
  const recentAttempts = rateLimit.get(email) || [];
  if (recentAttempts.length <= 1) {
    rateLimit.delete(email);
  } else {
    rateLimit.set(email, recentAttempts.slice(0, -1));
  }
  
  // Mark this email as verified for future use
  verifiedEmails.set(email.toLowerCase(), Date.now());
  
  return { valid: true, message: 'OTP verified successfully.' };
};

// --- Email change verification (per user, short-lived) ---
const emailChangeVerified = new Map(); // userId -> { newEmail, expiresAt }
const EMAIL_CHANGE_VERIFIED_TTL_MS = 10 * 60 * 1000; // 10 minutes

const setEmailChangeVerified = (userId, newEmail) => {
  const key = String(userId);
  emailChangeVerified.set(key, {
    newEmail: newEmail.trim().toLowerCase(),
    expiresAt: Date.now() + EMAIL_CHANGE_VERIFIED_TTL_MS
  });
};

const getEmailChangeVerified = (userId) => {
  const key = String(userId);
  const data = emailChangeVerified.get(key);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    emailChangeVerified.delete(key);
    return null;
  }
  return data.newEmail;
};

const clearEmailChangeVerified = (userId) => {
  emailChangeVerified.delete(String(userId));
};

// Check if an email has been verified by OTP
const isEmailVerified = (email) => {
  const lowercaseEmail = email.toLowerCase();
  // First check in-memory Map
  if (verifiedEmails.has(lowercaseEmail)) {
    return true;
  }
  
  // If not in memory, try to load from disk as a fallback
  try {
    if (fs.existsSync(verifiedEmailsFilePath)) {
      const data = fs.readFileSync(verifiedEmailsFilePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed[lowercaseEmail]) {
        // Add it back to memory for future checks
        verifiedEmails.set(lowercaseEmail, parsed[lowercaseEmail]);
        return true;
      }
    }
  } catch (error) {
    logger.error('Error checking verified email from disk: ' + (error && error.message));
  }
  
  return false;
};

// Mark an email as verified (for testing purposes)
const markEmailAsVerified = (email) => {
  const lowercaseEmail = email.toLowerCase();
  verifiedEmails.set(lowercaseEmail, Date.now());
  saveVerifiedEmailsToDisk(); // Save to disk immediately
};

// Remove email from verified list
const removeVerifiedEmail = (email) => {
  const lowercaseEmail = email.toLowerCase();
  verifiedEmails.delete(lowercaseEmail);
  saveVerifiedEmailsToDisk(); // Save to disk immediately
};

// Send OTP via email (SendGrid only)
const sendOTPEmail = async (email, otp) => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.error('Invalid email format: ' + email);
    return {
      success: false,
      error: 'Invalid email format',
      transportError: 'INVALID_EMAIL'
    };
  }

  if (!useSendGrid()) {
    return {
      success: false,
      error: 'Email service is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.',
      transportError: 'NO_CREDENTIALS'
    };
  }

  return await sendViaSendGrid(
    email,
    'Your OTP for CAprep Registration',
    generateEmailTemplate(email, otp),
    `Your OTP is ${otp}. Valid for 10 minutes.`
  );
};

const generateEmailTemplate = (name, otp) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
    <h2 style="color: #0288d1;">CAprep - Email Verification</h2>
    <p>Hello ${name}, please use the following OTP to verify your email address:</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
    <h1 style="color: #03a9f4; letter-spacing: 5px; margin: 0;">${otp}</h1>
    </div>
    <p>This OTP will expire in 10 minutes. If you did not request this, please ignore this email.</p>
    <p>Thank you for using CA Prep Platform!</p>
    <p style="margin-top: 30px; font-size: 12px; color: #777;">This is an automated message, please do not reply.</p>
    </div>
  `;
};

// Send password reset email with OTP (SendGrid only)
const sendPasswordResetEmail = async (email, otp) => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.error('Invalid email format: ' + email);
    return {
      success: false,
      error: 'Invalid email format',
      transportError: 'INVALID_EMAIL'
    };
  }

  if (!useSendGrid()) {
    return {
      success: false,
      error: 'Email service is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.',
      transportError: 'NO_CREDENTIALS'
    };
  }

  return await sendViaSendGrid(
    email,
    'Password Reset OTP for CAprep',
    generatePasswordResetTemplate(email, otp),
    `Your password reset OTP is ${otp}. Valid for 5 minutes.`
  );
};

const generatePasswordResetTemplate = (email, otp) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
    <h2 style="color: #0288d1;">CAprep - Password Reset</h2>
    <p>Hello ${email}, we received a request to reset your password. Please use the following OTP to reset your password:</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
    <h1 style="color: #03a9f4; letter-spacing: 5px; margin: 0;">${otp}</h1>
    </div>
    <p>This OTP will expire in 5 minutes. If you did not request this password reset, please ignore this email or contact support if you believe this is unauthorized activity.</p>
    <p>Thank you for using CA Prep Platform!</p>
    <p style="margin-top: 30px; font-size: 12px; color: #777;">This is an automated message, please do not reply.</p>
    </div>
  `;
};

// Send email when someone replies to a discussion (optional; used by discussions route)
const sendReplyNotificationEmail = async (toEmail, replyAuthorName, itemType, itemId, excerpt) => {
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return { success: false, error: 'Invalid email' };
  }
  const subject = 'New reply on CAprep discussion';
  const text = `${replyAuthorName} replied to a discussion (${itemType}): ${excerpt}. Log in to CAprep to view and respond.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0288d1;">CAprep - New reply</h2>
      <p><strong>${replyAuthorName}</strong> replied to a discussion (${itemType}):</p>
      <blockquote style="background: #f5f5f5; padding: 12px; border-left: 4px solid #03a9f4;">${excerpt}</blockquote>
      <p>Log in to CAprep to view and respond.</p>
      <p style="font-size: 12px; color: #777;">This is an automated notification.</p>
    </div>
  `;
  if (!useSendGrid()) {
    return { success: false, error: 'Email not configured. Set SENDGRID_API_KEY.' };
  }
  return await sendViaSendGrid(toEmail, subject, html, text);
};

module.exports = {
  generateOTP,
  verifyOTP,
  sendOTPEmail,
  isEmailVerified,
  markEmailAsVerified,
  removeVerifiedEmail,
  sendPasswordResetEmail,
  sendReplyNotificationEmail,
  setEmailChangeVerified,
  getEmailChangeVerified,
  clearEmailChangeVerified
};
