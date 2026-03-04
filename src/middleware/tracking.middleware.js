const crypto = require('crypto');
const logger = require('../utils/logger');

// Generate unique request ID
const generateRequestId = () => {
  return crypto.randomUUID();
};

// Request ID tracking middleware
const requestTracking = (req, res, next) => {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  // Attach to request object
  req.requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Add request ID to logger context
  const childLogger = logger.child({ requestId });
  req.logger = childLogger;
  
  // Log request start
  childLogger.info({
    event: 'request_start',
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    contentType: req.get('Content-Type')
  });
  
  // Track response time
  const startTime = Date.now();
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log request completion
    childLogger.info({
      event: 'request_end',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    });
    
    // Call original end
    originalEnd.apply(this, args);
  };
  
  next();
};

// Error logging with request context
const logError = (error, req = null) => {
  const errorContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };
  
  if (req && req.requestId) {
    req.logger.error(errorContext);
  } else {
    logger.error(errorContext);
  }
};

// Performance timing utility
const createTimer = (label, req = null) => {
  const startTime = process.hrtime.bigint();
  
  return {
    end: () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      const timingData = {
        event: 'performance_timing',
        label,
        duration: `${duration.toFixed(2)}ms`
      };
      
      if (req && req.requestId) {
        req.logger.info(timingData);
      } else {
        logger.info(timingData);
      }
      
      return duration;
    }
  };
};

// Sensitive data masking
const maskSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = [
    'password',
    'token',
    'refreshToken',
    'accessToken',
    'authorization',
    'cookie',
    'secret',
    'key'
  ];
  
  const masked = { ...data };
  
  const maskObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        maskObject(obj[key]);
      } else if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      }
    }
  };
  
  maskObject(masked);
  return masked;
};

module.exports = {
  generateRequestId,
  requestTracking,
  logError,
  createTimer,
  maskSensitiveData
};
