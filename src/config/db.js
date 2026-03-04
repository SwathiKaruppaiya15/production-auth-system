const { Pool } = require("pg");
require("dotenv").config();
const logger = require("../utils/logger");

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUTMillis) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUTMillis) || 2000,
  // Add SSL configuration for production
  ssl: isProduction ? {
    rejectUnauthorized: true,
    require: process.env.DB_SSL_MODE === 'require'
  } : false
};

const pool = new Pool(poolConfig);

// Log connection attempts
pool.on('connect', (client) => {
  logger.info('New database client connected');
});

pool.on('error', (err) => {
  logger.error('Database pool error:', err);
});

// Test connection on startup (non-blocking for development)
pool.connect()
  .then((client) => {
    logger.info('Database connected successfully');
    client.release();
  })
  .catch((err) => {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Database connection failed in development mode:', err.message);
      logger.warn('Server will continue without database connection');
    } else {
      logger.error('Database connection failed:', err.message);
      process.exit(1);
    }
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
  process.exit(0);
});

module.exports = pool;