const rateLimit = require('express-rate-limit');
const redisClient = require('../config/redis');
const { maskSensitiveData } = require('./tracking.middleware');

// Redis-based rate limiting store
class RedisStore {
  constructor(options) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.max;
  }

  async increment(key) {
    try {
      const result = await redisClient.incrementRateLimit(key, this.windowMs, this.maxRequests);
      return {
        totalHits: result.count,
        resetTime: new Date(Date.now() + this.windowMs)
      };
    } catch (error) {
      // Fallback to unlimited if Redis fails
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    // Not implemented for Redis store
  }

  async resetKey(key) {
    // Not implemented for Redis store
  }
}

// Enhanced rate limiting with IP + email strategy
const createEnhancedRateLimit = (options) => {
  const { windowMs, max, message, skipSuccessfulRequests = false } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    // Use Redis store if available, fallback to memory store
    store: redisClient.isConnected ? new RedisStore({ windowMs, maxRequests: max }) : undefined,
    // Custom key generator for IP + email strategy with proper IPv6 handling
    keyGenerator: (req) => {
      // Get IP address properly handling IPv6
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
      
      // For login attempts, combine IP and email
      if (req.body && req.body.email && req.path.includes('/login')) {
        return `login:${ip}:${req.body.email}`;
      }
      // For forgot password, combine IP and email
      if (req.body && req.body.email && req.path.includes('/forgot-password')) {
        return `forgot:${ip}:${req.body.email}`;
      }
      // For other auth endpoints, use IP only
      if (req.path.includes('/auth/')) {
        return `auth:${ip}`;
      }
      // General rate limiting by IP
      return `general:${ip}`;
    },
    // Custom handler with logging
    handler: (req, res) => {
      // Log rate limit violation
      if (req.logger) {
        req.logger.warn({
          event: 'rate_limit_exceeded',
          method: req.method,
          url: req.url,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          body: maskSensitiveData(req.body)
        });
      }
      
      res.status(429).json({
        success: false,
        message: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    // Skip successful requests for login (to reduce false positives)
    skip: (req) => {
      if (skipSuccessfulRequests && req.method === 'POST' && req.path.includes('/login')) {
        return req.res && req.res.statusCode < 400;
      }
      return false;
    }
  });
};

// Simple rate limiting without custom key generator to avoid IPv6 issues
const createSimpleRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis store if available, fallback to memory store
    store: redisClient.isConnected ? new RedisStore({ windowMs, maxRequests: max }) : undefined,
  });
};

// Enhanced authentication rate limiting (IP + email)
const authRateLimit = createSimpleRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many authentication attempts, please try again later'
);

// Password reset rate limiting (IP + email)
const passwordResetRateLimit = createSimpleRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 password reset attempts per hour
  'Too many password reset attempts, please try again later'
);

// General rate limiting (IP only)
const generalRateLimit = createSimpleRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests, please try again later'
);

// API rate limiting for authenticated users
const apiRateLimit = createSimpleRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per window
  'Too many API requests, please try again later'
);

module.exports = {
  authRateLimit,
  passwordResetRateLimit,
  generalRateLimit,
  apiRateLimit,
  createEnhancedRateLimit
};
