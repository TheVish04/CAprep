const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const Resource = require('../models/ResourceModel');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const User = require('../models/UserModel');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configure multer to use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// File filter to ensure only PDF files are uploaded
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // Increased to 20MB to match server limit
});

// Import cloudinary configuration
const cloudinary = require('../config/cloudinary');

// GET all resources with optional filtering
router.get('/', [authMiddleware, cacheMiddleware(300)], async (req, res) => {
  try {
    const { subject, paperType, examStage, year, month, search, bookmarked } = req.query;
    const filters = {};
    
    // Apply standard filters
    if (subject) filters.subject = subject;
    if (paperType) filters.paperType = paperType;
    if (examStage) filters.examStage = examStage;
    if (year) filters.year = year;
    if (month) filters.month = month;
    
    // Text search
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Bookmark filter
    if (bookmarked === 'true') {
        const user = await User.findById(req.user.id).select('bookmarkedResources');
        if (!user) {
            return res.status(404).json({ error: 'User not found for bookmark filtering' });
        }
        // Ensure user.bookmarkedResources is an array, even if empty
        const bookmarkedIds = user.bookmarkedResources || []; 
        // If filtering by bookmarks, the resource _id must be in the user's list
        filters._id = { $in: bookmarkedIds }; 
    }
    
    const resources = await Resource.find(filters).sort({ createdAt: -1 });
    
    res.status(200).json(resources);
  } catch (error) {
    if (typeof logger !== 'undefined' && logger.error) {
         logger.error(`Error retrieving resources: ${error.message}`);
    } else {
        console.error(`Error retrieving resources: ${error.message}`);
    }
    res.status(500).json({ error: 'Failed to retrieve resources' });
  }
});

// GET count of all resources
router.get('/count', cacheMiddleware(300), async (req, res) => {
  try {
    const count = await Resource.countDocuments({});
    res.status(200).json({ count });
  } catch (error) {
    logger.error(`Error counting resources: ${error.message}`);
    res.status(500).json({ error: 'Failed to count resources' });
  }
});

// GET a single resource by ID
router.get('/:id', [authMiddleware, cacheMiddleware(3600)], async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    res.status(200).json(resource);
  } catch (error) {
    logger.error(`Error retrieving resource: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve resource' });
  }
});

// POST - Create a new resource (admin only)
router.post('/', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    // Check file size explicitly with a clearer message
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        error: 'Failed to create resource',
        details: `File size too large. Maximum allowed size is 20MB (${maxSize} bytes), but received ${req.file.size} bytes.`
      });
    }
    
    // Log upload attempt
    console.log(`Attempting to upload file: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);
    
    // Upload file to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    // Generate a clean filename (alphanumeric with hyphens)
    const cleanFilename = req.file.originalname
      .replace(/[^\w.-]/g, '-')
      .replace(/\.pdf$/i, '');
    
    // Create a unique public_id
    const uniqueId = `${uuidv4().substring(0, 8)}-${cleanFilename}`;
    
    const uploadOptions = {
      resource_type: 'image',  // 'image' handles PDFs better than 'raw' or 'auto'
      folder: 'ca-exam-platform/resources',
      public_id: uniqueId,
      format: 'pdf',
      type: 'upload',
      access_mode: 'public',
      // Optimize PDF for viewing and downloading
      transformation: [
        { fetch_format: 'auto' },
        { quality: 'auto' }
      ],
      invalidate: true,  // Invalidate any cached versions
      use_filename: true,
      unique_filename: true,
      overwrite: true
    };
    
    console.log('Cloudinary upload options:', JSON.stringify(uploadOptions));
    
    const result = await cloudinary.uploader.upload(dataURI, uploadOptions)
      .catch(err => {
        console.error('Cloudinary upload error details:', JSON.stringify(err));
        throw err;
      });
    
    console.log('Cloudinary upload successful. Result:', JSON.stringify({
      public_id: result.public_id,
      format: result.format,
      resource_type: result.resource_type,
      secure_url: result.secure_url,
      bytes: result.bytes,
      type: result.type
    }));
    
    // Create new resource with Cloudinary URL
    const resource = new Resource({
      title: req.body.title,
      subject: req.body.subject,
      paperType: req.body.paperType,
      year: req.body.year,
      month: req.body.month,
      examStage: req.body.examStage,
      fileUrl: result.secure_url,
      fileType: 'pdf',
      fileSize: req.file.size,
      resourceType: 'pdf'  // Explicitly set the type
    });
    
    const savedResource = await resource.save();
    
    // Clear all resource-related caches
    clearCache('/api/resources');
    
    // Return the complete resource object with all fields
    console.log('Resource saved successfully:', savedResource._id);
    
    res.status(201).json(savedResource);
  } catch (error) {
    console.error(`Error creating resource: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    res.status(500).json({ 
      error: 'Failed to create resource',
      details: error.message
    });
  }
});

// PUT - Update a resource (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const allowedUpdates = [
      'title', 'subject', 'paperType', 
      'year', 'month', 'examStage'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    clearCache([`/api/resources/${req.params.id}`, '/api/resources']);
    res.status(200).json(resource);
  } catch (error) {
    logger.error(`Error updating resource: ${error.message}`);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

// DELETE - Remove a resource (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Delete the file from Cloudinary if it's a Cloudinary URL
    if (resource.fileUrl && resource.fileUrl.includes('cloudinary')) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = resource.fileUrl.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExt.split('.')[0];
        
        if (publicId) {
          await cloudinary.uploader.destroy(`ca-exam-platform/resources/${publicId}`, { 
            resource_type: 'auto'
          });
        }
      } catch (cloudinaryError) {
        logger.error(`Error deleting file from Cloudinary: ${cloudinaryError.message}`);
        // Continue with deletion even if Cloudinary delete fails
      }
    }
    
    // Delete the resource from database
    await Resource.findByIdAndDelete(req.params.id);
    clearCache([`/api/resources/${req.params.id}`, '/api/resources']);
    res.status(200).json({ message: 'Resource deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting resource: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// POST - Increment download count
router.post('/:id/download', async (req, res) => {
  try {
    console.log(`Incrementing download count for resource ID: ${req.params.id}`);
    
    // Check for authentication
    let token = null;
    
    // Check for token in query parameter
    if (req.query.token) {
      token = req.query.token;
    } 
    // Check for token in Authorization header as fallback
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // No token validation required for download count
    // This makes download tracking more reliable
    
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloadCount: 1 } },
      { new: true }
    );
    
    if (!resource) {
      console.log(`Resource not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    console.log(`Download count incremented for resource ID: ${req.params.id}, new count: ${resource.downloadCount}`);
    res.status(200).json({ downloadCount: resource.downloadCount });
  } catch (error) {
    console.error(`Error incrementing download count: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    res.status(500).json({ 
      error: 'Failed to increment download count',
      details: error.message
    });
  }
});

// GET - Stream a PDF file from Cloudinary
router.get('/:id/download', async (req, res) => {
  try {
    console.log(`PDF download request for resource ID: ${req.params.id}`);
    
    // Get token from query parameter or authorization header
    let token = null;
    
    // Check for token in query parameter
    if (req.query.token) {
      token = req.query.token;
      console.log('Using token from query parameter');
    } 
    // Check for token in Authorization header as fallback
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('Using token from Authorization header');
    }
    
    // If no token is provided, return unauthorized
    if (!token) {
      console.log('No token provided for download');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      console.log('Invalid token provided');
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    
    // Find the resource
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      console.log(`Resource not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Increment download count
    resource.downloadCount = (resource.downloadCount || 0) + 1;
    await resource.save();
    
    const fileUrl = resource.fileUrl;
    console.log(`Resource URL: ${fileUrl}`);
    
    if (!fileUrl) {
      console.log(`No file URL found for resource: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource file not found' });
    }
    
    // For Cloudinary URLs, proxy the PDF to avoid CORS issues
    if (fileUrl.includes('cloudinary')) {
      console.log('Proxying Cloudinary PDF download');
      
      try {
        console.log(`Attempting to fetch from Cloudinary URL: ${fileUrl}`);
        
        // Get the file from Cloudinary
        const response = await axios({
          method: 'GET',
          url: fileUrl,
          responseType: 'stream',
          timeout: 30000 // 30 second timeout
        });
        
        console.log('Successfully fetched file from Cloudinary');
        console.log(`Response status: ${response.status}`);
        console.log(`Response headers: ${JSON.stringify(response.headers)}`);
        
        // Set appropriate headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${resource.title.replace(/[^\s.-]/g, '')}.pdf"`);
        
        // Pipe the file to the response
        response.data.pipe(res);
      } catch (error) {
        console.error(`Error streaming PDF from Cloudinary: ${error.message}`);
        console.error(`Error name: ${error.name}`);
        console.error(`Error stack: ${error.stack}`);
        
        if (error.response) {
          console.error(`Cloudinary response status: ${error.response.status}`);
          console.error(`Cloudinary response headers: ${JSON.stringify(error.response.headers)}`);
          console.error(`Cloudinary response data: ${JSON.stringify(error.response.data)}`);
          
          return res.status(error.response.status).json({ 
            error: 'Failed to download file from storage',
            details: `Cloudinary responded with status ${error.response.status}`
          });
        } else if (error.request) {
          console.error('No response received from Cloudinary');
          return res.status(504).json({ 
            error: 'Failed to download file from storage',
            details: 'No response received from storage provider'
          });
        } else {
          console.error('Error setting up request to Cloudinary');
          return res.status(500).json({ 
            error: 'Failed to download file from storage',
            details: error.message
          });
        }
      }
    } else {
      // For non-Cloudinary URLs, redirect to the file
      console.log('Redirecting to direct file URL');
      return res.redirect(fileUrl);
    }
  } catch (error) {
    console.error(`Error in download proxy: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    res.status(500).json({ 
      error: 'Failed to download resource',
      details: error.message
    });
  }
});

// Add a new route to generate a proper download URL for a resource
router.get('/:id/download-url', authMiddleware, async (req, res) => {
  try {
    console.log(`Download URL request for resource ID: ${req.params.id}`);
    
    // Find the resource
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      console.log(`Resource not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Increment download count
    resource.downloadCount = (resource.downloadCount || 0) + 1;
    await resource.save();
    
    if (!resource.fileUrl) {
      console.log(`No file URL found for resource: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource file not found' });
    }
    
    // For Cloudinary URLs, generate a proper download URL
    if (resource.fileUrl.includes('cloudinary')) {
      const urlParts = resource.fileUrl.split('/upload/');
      
      if (urlParts.length === 2) {
        // Extract the public ID including the folder path
        const fullPath = urlParts[1];
        // Remove any existing flags or version info from the path
        const cleanPath = fullPath.replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');
        
        console.log(`Extracted path: ${cleanPath}`);
        
        // Generate Cloudinary URL using the full path as public ID
        try {
          // For PDFs, we need to force download with fl_attachment
          // but apply it directly in the URL, not through the transformation
          const baseUrl = cloudinary.url(cleanPath, {
            resource_type: 'image',
            format: 'pdf',
            secure: true,
            // Don't use any transformations that might corrupt the PDF
          });
          
          // Return both the direct URL for viewing and a download URL with attachment flag
          console.log(`Generated base URL: ${baseUrl}`);
          
          return res.status(200).json({ 
            downloadUrl: baseUrl, // Clean URL for downloading
            viewUrl: baseUrl,    // URL for viewing in browser
            filename: `${resource.title.replace(/[^\w\s.-]/g, '')}.pdf` 
          });
        } catch (err) {
          console.error('Error generating URL as image type:', err);
          
          // If that fails, try as raw type
          try {
            const baseUrl = cloudinary.url(cleanPath, {
              resource_type: 'raw',
              format: 'pdf',
              secure: true
            });
            
            // Add fl_attachment flag to URL
            const downloadUrl = baseUrl.replace('/upload/', '/upload/fl_attachment/');
            
            console.log(`Generated download URL (raw type): ${downloadUrl}`);
            
            return res.status(200).json({ 
              downloadUrl, 
              filename: `${resource.title.replace(/[^\w\s.-]/g, '')}.pdf` 
            });
          } catch (err2) {
            console.error('Error generating URL as raw type:', err2);
            // Fall through to the direct URL approach
          }
        }
      }
    }
    
    // If we couldn't generate a Cloudinary URL, return the original URL
    console.log('Using original file URL:', resource.fileUrl);
    return res.status(200).json({ 
      downloadUrl: resource.fileUrl,
      filename: `${resource.title.replace(/[^\w\s.-]/g, '')}.pdf`
    });
  } catch (error) {
    console.error(`Error generating download URL: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    res.status(500).json({ 
      error: 'Failed to generate download URL',
      details: error.message
    });
  }
});

module.exports = router;