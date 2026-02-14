const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { sendErrorResponse } = require('../utils/errorResponse');
const { escapeRegex } = require('../utils/escapeRegex');
const Resource = require('../models/ResourceModel');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const User = require('../models/UserModel');
const { logAudit } = require('../utils/auditLog');
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

// GET all resources with optional filtering and pagination
router.get('/', [authMiddleware, cacheMiddleware(300)], async (req, res) => {
  try {
    const { subject, paperType, examStage, year, month, search, bookmarked, page, limit } = req.query;
    const filters = {};
    
    if (subject) filters.subject = subject;
    if (paperType) filters.paperType = paperType;
    if (examStage) filters.examStage = examStage;
    if (year) filters.year = year;
    if (month) filters.month = month;
    
    if (search) {
      const safeSearch = escapeRegex(search);
      filters.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
      ];
    }
    
    if (bookmarked === 'true') {
      const user = await User.findById(req.user.id).select('bookmarkedResources');
      if (!user) {
        return res.status(404).json({ error: 'User not found for bookmark filtering' });
      }
      const bookmarkedIds = user.bookmarkedResources || [];
      filters._id = { $in: bookmarkedIds };
    }
    
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const [resources, total] = await Promise.all([
      Resource.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Resource.countDocuments(filters)
    ]);
    
    res.status(200).json({
      data: resources,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to retrieve resources', error });
  }
});

// GET count of all resources
router.get('/count', cacheMiddleware(300), async (req, res) => {
  try {
    const count = await Resource.countDocuments({});
    res.status(200).json({ count });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to count resources', error });
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
    sendErrorResponse(res, 500, { message: 'Failed to retrieve resource', error });
  }
});

// POST - Rate a resource (auth required)
router.post('/:id/rate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    
    if (rating == null || typeof rating !== 'number') {
      return res.status(400).json({ error: 'Rating (1-5) is required' });
    }
    
    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    await resource.addRating(rating);
    clearCache([`/api/resources/${id}`, '/api/resources']);
    
    res.status(200).json({
      success: true,
      rating: {
        average: resource.rating.average,
        count: resource.rating.count,
      },
    });
  } catch (error) {
    if (error.message?.includes('Rating must be between 1 and 5')) {
      return res.status(400).json({ error: error.message });
    }
    sendErrorResponse(res, 500, { message: 'Failed to rate resource', error });
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
    logger.log(`Attempting to upload file: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);
    
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
      resource_type: 'raw',  // Use 'raw' for PDFs (image type is for images only)
      folder: 'ca-exam-platform/resources',
      public_id: uniqueId,
      type: 'upload',
      access_mode: 'public',
      invalidate: true,
      use_filename: true,
      unique_filename: true,
      overwrite: true
    };
    
    logger.log('Cloudinary upload options:', JSON.stringify(uploadOptions));
    
    const result = await cloudinary.uploader.upload(dataURI, uploadOptions)
      .catch(err => {
        logger.error('Cloudinary upload error details: ' + (err && (err.message || JSON.stringify(err))));
        throw err;
      });
    
    logger.log('Cloudinary upload successful. Result:', JSON.stringify({
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
    
    clearCache('/api/resources');
    await logAudit(req.user.id, 'create', 'resource', savedResource._id, { title: savedResource.title, subject: savedResource.subject });
    logger.log('Resource saved successfully:', savedResource._id);
    
    res.status(201).json(savedResource);
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to create resource', error });
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
    await logAudit(req.user.id, 'update', 'resource', req.params.id, { title: resource.title });
    res.status(200).json(resource);
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to update resource', error });
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
    
    const title = resource.title;
    await Resource.findByIdAndDelete(req.params.id);
    clearCache([`/api/resources/${req.params.id}`, '/api/resources']);
    await logAudit(req.user.id, 'delete', 'resource', req.params.id, { title });
    res.status(200).json({ message: 'Resource deleted successfully' });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to delete resource', error });
  }
});

// POST - Increment download count
router.post('/:id/download', async (req, res) => {
  try {
    logger.log(`Incrementing download count for resource ID: ${req.params.id}`);
    
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
      logger.log(`Resource not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    logger.log(`Download count incremented for resource ID: ${req.params.id}, new count: ${resource.downloadCount}`);
    res.status(200).json({ downloadCount: resource.downloadCount });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to increment download count', error });
  }
});

// GET - Stream a PDF file from Cloudinary
router.get('/:id/download', async (req, res) => {
  try {
    logger.log(`PDF download request for resource ID: ${req.params.id}`);
    
    // Get token from query parameter or authorization header
    let token = null;
    
    // Check for token in query parameter
    if (req.query.token) {
      token = req.query.token;
      logger.log('Using token from query parameter');
    } 
    // Check for token in Authorization header as fallback
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      logger.log('Using token from Authorization header');
    }
    
    // If no token is provided, return unauthorized
    if (!token) {
      logger.log('No token provided for download');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      logger.log('Invalid token provided');
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    
    // Find the resource
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      logger.log(`Resource not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Increment download count
    resource.downloadCount = (resource.downloadCount || 0) + 1;
    await resource.save();
    
    const fileUrl = resource.fileUrl;
    logger.log(`Resource URL: ${fileUrl}`);
    
    if (!fileUrl) {
      logger.log(`No file URL found for resource: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource file not found' });
    }
    
    // For Cloudinary URLs, proxy the PDF to avoid CORS issues
    if (fileUrl.includes('cloudinary')) {
      logger.log('Proxying Cloudinary PDF download');
      
      try {
        logger.log(`Attempting to fetch from Cloudinary URL: ${fileUrl}`);
        
        // Get the file from Cloudinary
        const response = await axios({
          method: 'GET',
          url: fileUrl,
          responseType: 'stream',
          timeout: 30000 // 30 second timeout
        });
        
        logger.log('Successfully fetched file from Cloudinary');
        logger.log(`Response status: ${response.status}`);
        logger.log(`Response headers: ${JSON.stringify(response.headers)}`);
        
        // Set appropriate headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${resource.title.replace(/[^\s.-]/g, '')}.pdf"`);
        
        // Pipe the file to the response
        response.data.pipe(res);
      } catch (error) {
        logger.error(`Error streaming PDF from Cloudinary: ${error.message}`);
        logger.error(`Error name: ${error.name}`);
        logger.error(`Error stack: ${error.stack}`);
        
        if (error.response) {
          logger.error(`Cloudinary response status: ${error.response.status}`);
          logger.error(`Cloudinary response headers: ${JSON.stringify(error.response.headers)}`);
          logger.error(`Cloudinary response data: ${JSON.stringify(error.response.data)}`);
          
          return res.status(error.response.status).json({ 
            error: 'Failed to download file from storage',
            details: `Cloudinary responded with status ${error.response.status}`
          });
        } else if (error.request) {
          logger.error('No response received from Cloudinary');
          return res.status(504).json({ 
            error: 'Failed to download file from storage',
            details: 'No response received from storage provider'
          });
        } else {
          return sendErrorResponse(res, 500, { message: 'Failed to download file from storage', error });
        }
      }
    } else {
      // For non-Cloudinary URLs, redirect to the file
      logger.log('Redirecting to direct file URL');
      return res.redirect(fileUrl);
    }
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to download resource', error });
  }
});

// Add a new route to generate a proper download URL for a resource
router.get('/:id/download-url', authMiddleware, async (req, res) => {
  try {
    logger.log(`Download URL request for resource ID: ${req.params.id}`);
    
    // Find the resource
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      logger.log(`Resource not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Increment download count
    resource.downloadCount = (resource.downloadCount || 0) + 1;
    await resource.save();
    
    if (!resource.fileUrl) {
      logger.log(`No file URL found for resource: ${req.params.id}`);
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
        
        logger.log(`Extracted path: ${cleanPath}`);
        
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
          logger.log(`Generated base URL: ${baseUrl}`);
          
          return res.status(200).json({ 
            downloadUrl: baseUrl, // Clean URL for downloading
            viewUrl: baseUrl,    // URL for viewing in browser
            filename: `${resource.title.replace(/[^\w\s.-]/g, '')}.pdf` 
          });
        } catch (err) {
          logger.error('Error generating URL as image type: ' + (err && err.message));
          
          // If that fails, try as raw type
          try {
            const baseUrl = cloudinary.url(cleanPath, {
              resource_type: 'raw',
              format: 'pdf',
              secure: true
            });
            
            // Add fl_attachment flag to URL
            const downloadUrl = baseUrl.replace('/upload/', '/upload/fl_attachment/');
            
            logger.log(`Generated download URL (raw type): ${downloadUrl}`);
            
            return res.status(200).json({ 
              downloadUrl, 
              filename: `${resource.title.replace(/[^\w\s.-]/g, '')}.pdf` 
            });
          } catch (err2) {
            logger.error('Error generating URL as raw type: ' + (err2 && err2.message));
            // Fall through to the direct URL approach
          }
        }
      }
    }
    
    // If we couldn't generate a Cloudinary URL, return the original URL
    logger.log('Using original file URL:', resource.fileUrl);
    return res.status(200).json({ 
      downloadUrl: resource.fileUrl,
      filename: `${resource.title.replace(/[^\w\s.-]/g, '')}.pdf`
    });
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to generate download URL', error });
  }
});

module.exports = router;