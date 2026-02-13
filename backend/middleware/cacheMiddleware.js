const NodeCache = require('node-cache');

const isDev = process.env.NODE_ENV !== 'production';

// Initialize cache with a standard TTL (time-to-live) of 5 minutes (300 seconds)
// and checkperiod every 1 minute (60 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const cacheMiddleware = (duration) => (req, res, next) => {
  // Skip caching if specifically requested
  if (req.headers['x-skip-cache'] === 'true') {
    if (isDev) console.log(`Skipping cache for request: ${req.originalUrl}`);
    return next();
  }

  // Only cache GET requests
  if (req.method !== 'GET') {
    if (isDev) console.log(`Not caching ${req.method} request to ${req.originalUrl}`);
    return next();
  }

  // Use the request URL as the cache key, include auth to differentiate between users
  const userId = req.user ? req.user.id : 'guest';
  const key = `${userId}:${req.originalUrl}`;

  // Check if we have a cached response for this request
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    if (isDev) console.log(`Cache hit for key: ${key}`);
    return res.send(cachedResponse);
  }

  if (isDev) console.log(`Cache miss for key: ${key}`);

  // Monkey patch res.send: call originalSend first, then cache on success (avoids caching if send throws)
  res.originalSend = res.send;
  res.send = (body) => {
    res.originalSend(body);
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, duration);
        if (isDev) console.log(`Cache set for key: ${key} with duration: ${duration}s`);
      } else if (isDev) {
        console.log(`Not caching response with status code: ${res.statusCode}`);
      }
    } catch (error) {
      console.error(`Error setting cache for ${key}:`, error);
    }
  };

  next();
};

// Clear cache for a single route pattern (string)
const clearCacheForPattern = (routePattern) => {
  if (typeof routePattern !== 'string') return;
  const cacheKeys = cache.keys();
  if (cacheKeys.length === 0) return;
  const keysToDelete = cacheKeys.filter(key => {
    const routePart = key.split(':').slice(1).join(':');
    return routePart.startsWith(routePattern);
  });
  keysToDelete.forEach(key => cache.del(key));
  if (keysToDelete.length > 0 && isDev) {
    console.log(`Cleared ${keysToDelete.length} cache entries for pattern: ${routePattern}`);
  }
};

// Function to clear the cache for specific routes (accepts string or array of strings)
const clearCache = (routePattern) => {
  try {
    if (Array.isArray(routePattern)) {
      routePattern.forEach(p => clearCacheForPattern(p));
      return;
    }
    if (typeof routePattern !== 'string') {
      console.error('Invalid route pattern for cache clearing:', routePattern);
      return;
    }
    if (isDev) console.log(`Attempting to clear cache for pattern: ${routePattern}`);
    clearCacheForPattern(routePattern);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Function to manually clear all cache - useful for admin operations
const clearAllCache = () => {
  try {
    const keysCount = cache.keys().length;
    cache.flushAll();
    if (isDev) console.log(`Cleared all cache entries (${keysCount} items)`);
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
};

module.exports = { cacheMiddleware, clearCache, clearAllCache }; 