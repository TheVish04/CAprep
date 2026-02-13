const NodeCache = require('node-cache');

// Initialize cache with a standard TTL (time-to-live) of 5 minutes (300 seconds)
// and checkperiod every 1 minute (60 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const cacheMiddleware = (duration) => (req, res, next) => {
  // Skip caching if specifically requested
  if (req.headers['x-skip-cache'] === 'true') {
    console.log(`Skipping cache for request: ${req.originalUrl}`);
    return next();
  }

  // Only cache GET requests
  if (req.method !== 'GET') {
    console.log(`Not caching ${req.method} request to ${req.originalUrl}`);
    return next();
  }

  // Use the request URL as the cache key, include auth to differentiate between users
  const userId = req.user ? req.user.id : 'guest';
  const key = `${userId}:${req.originalUrl}`;

  // Check if we have a cached response for this request
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    console.log(`Cache hit for key: ${key}`);
    return res.send(cachedResponse);
  } 
  
  console.log(`Cache miss for key: ${key}`);
  
  // Monkey patch res.send to cache the response before sending it
  res.originalSend = res.send;
  res.send = (body) => {
    try {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, duration);
        console.log(`Cache set for key: ${key} with duration: ${duration}s`);
      } else {
        console.log(`Not caching response with status code: ${res.statusCode}`);
      }
    } catch (error) {
      console.error(`Error setting cache for ${key}:`, error);
    }
    
    // Call the original send
    res.originalSend(body);
  };
  
  next();
};

// Function to clear the cache for specific routes
const clearCache = (routePattern) => {
  try {
    if (typeof routePattern !== 'string') {
      console.error('Invalid route pattern for cache clearing:', routePattern);
      return;
    }

    // Log the operation
    console.log(`Attempting to clear cache for pattern: ${routePattern}`);
    
    // Get all cache keys
    const cacheKeys = cache.keys();
    
    if (cacheKeys.length === 0) {
      console.log('No cache keys found to clear');
      return;
    }
    
    // Find keys that match the pattern
    const keysToDelete = cacheKeys.filter(key => {
      // Split the key to get the route part (after the userId:)
      const routePart = key.split(':').slice(1).join(':');
      return routePart.startsWith(routePattern);
    });
    
    // Delete matched keys
    if (keysToDelete.length > 0) {
      keysToDelete.forEach(key => {
        cache.del(key);
        console.log(`Cleared cache for key: ${key}`);
      });
      console.log(`Cleared ${keysToDelete.length} cache entries for pattern: ${routePattern}`);
    } else {
      console.log(`No matching cache keys found for pattern: ${routePattern}`);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Function to manually clear all cache - useful for admin operations
const clearAllCache = () => {
  try {
    const keysCount = cache.keys().length;
    cache.flushAll();
    console.log(`Cleared all cache entries (${keysCount} items)`);
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
};

module.exports = { cacheMiddleware, clearCache, clearAllCache }; 