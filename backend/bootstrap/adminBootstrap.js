const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/UserModel');

/**
 * Check if an admin user exists and create one from env if not.
 * Called during server initialization.
 */
const checkAndCreateAdmin = async () => {
  try {
    console.log('Checking for existing admin users...');

    if (!User || typeof User.countDocuments !== 'function') {
      throw new Error('User model not properly initialized');
    }

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Cannot create admin user: Database not connected');
    }

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
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (adminCount === 0) {
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

      let hashedPassword;
      try {
        hashedPassword = await bcrypt.hash(adminPassword, 12);
      } catch (err) {
        console.error('Failed to hash admin password:', err);
        throw new Error('Admin creation failed: Password hashing error');
      }

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
            console.warn('Admin user appears to exist (duplicate key error). Rechecking...');
            const existingAdmin = await User.findOne({ email: adminEmail });
            if (existingAdmin) {
              console.log('Admin user found on recheck:', {
                fullName: existingAdmin.fullName,
                email: existingAdmin.email,
                role: existingAdmin.role
              });
              return;
            }
          }
          console.error(`Failed to create admin user (retries left: ${retries}):`, err.message);
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (admin) {
        console.log('Admin user created successfully:', {
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
            role: existingAdmin.role
          });
        } else {
          console.warn('Admin count is non-zero but findOne returned no results. This is unexpected.');
        }
      } catch (err) {
        console.error('Error fetching existing admin details:', err.message);
      }
    }
  } catch (error) {
    console.error('Admin initialization error:', error.message);
    console.error(error.stack);
    console.warn('Server continuing without admin initialization. Admin features may not work correctly.');
  }
};

module.exports = { checkAndCreateAdmin };
