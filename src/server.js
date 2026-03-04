require('dotenv').config();
const logger = require('./utils/logger');
const pool = require('./config/db');
const redisClient = require('./config/redis');
const { requestTracking } = require('./middleware/tracking.middleware');
const { metricsHandler, prometheusMetricsHandler } = require('./utils/metrics');
const backgroundJobs = require('./jobs/background');
const app = require('./app');
const PORT = process.env.PORT || 3000;

// Initialize Redis connection
async function initializeRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis initialized successfully');
  } catch (error) {
    logger.warn('Redis initialization failed, continuing without Redis:', error.message);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Test database connectivity
    const dbCheck = await pool.query('SELECT NOW()');
    const dbConnected = dbCheck.rows.length > 0;
    
    // Test Redis connectivity
    const redisConnected = await redisClient.ping();
    
    const response = {
      status: (dbConnected && redisConnected) ? 'ok' : 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        responseTime: Date.now() - startTime
      },
      redis: {
        connected: redisConnected,
        info: redisClient.getConnectionInfo()
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
      },
      version: process.env.npm_package_version || '1.0.0',
      backgroundJobs: backgroundJobs.getStatus()
    };
    
    const statusCode = (dbConnected && redisConnected) ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: 'Database connection failed'
      },
      redis: {
        connected: false,
        error: 'Redis connection failed'
      }
    });
  }
});

// Metrics endpoints
app.get('/metrics', metricsHandler);
app.get('/metrics/prometheus', prometheusMetricsHandler);

// Request tracking middleware
app.use(requestTracking);

// Start server
async function startServer() {
  try {
    // Initialize Redis
    await initializeRedis();
    
    // Start background jobs
    backgroundJobs.start();
    
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`Metrics available at http://localhost:${PORT}/metrics`);
      logger.info(`Prometheus metrics at http://localhost:${PORT}/metrics/prometheus`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Stop background jobs
        backgroundJobs.stop();
        
        // Close Redis connection
        if (redisClient.isConnected) {
          await redisClient.disconnect();
        }
        
        // Database pool is already handled in db.js
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Enhanced error handlers
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack,
        pid: process.pid
      });
      
      // Attempt graceful shutdown
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', {
        reason: reason.toString(),
        promise: promise.toString(),
        stack: reason.stack
      });
      
      // Don't exit immediately, but log and potentially shutdown
      if (process.env.NODE_ENV === 'production') {
        gracefulShutdown('unhandledRejection');
      }
    });

    // Handle process warnings
    process.on('warning', (warning) => {
      logger.warn('Process Warning:', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });

    return server;
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});