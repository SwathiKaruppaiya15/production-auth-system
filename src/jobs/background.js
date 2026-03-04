const pool = require('../config/db');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class BackgroundJobs {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Background jobs already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting background cleanup jobs');

    // Cleanup expired refresh tokens (every 1 hour)
    this.intervals.set('refreshTokens', setInterval(
      this.cleanupExpiredRefreshTokens.bind(this),
      60 * 60 * 1000 // 1 hour
    ));

    // Cleanup expired verification tokens (every 30 minutes)
    this.intervals.set('verificationTokens', setInterval(
      this.cleanupExpiredVerificationTokens.bind(this),
      30 * 60 * 1000 // 30 minutes
    ));

    // Cleanup expired password reset tokens (every 15 minutes)
    this.intervals.set('resetTokens', setInterval(
      this.cleanupExpiredResetTokens.bind(this),
      15 * 60 * 1000 // 15 minutes
    ));

    // Cleanup expired Redis rate limit keys (every 5 minutes)
    this.intervals.set('redisKeys', setInterval(
      this.cleanupExpiredRedisKeys.bind(this),
      5 * 60 * 1000 // 5 minutes
    ));

    // Log system metrics (every 5 minutes)
    this.intervals.set('metrics', setInterval(
      this.logSystemMetrics.bind(this),
      5 * 60 * 1000 // 5 minutes
    ));

    // Run initial cleanup
    this.runInitialCleanup();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping background cleanup jobs');
    this.isRunning = false;

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.info(`Stopped ${name} cleanup job`);
    }

    this.intervals.clear();
  }

  async runInitialCleanup() {
    logger.info('Running initial cleanup of expired tokens');
    
    try {
      await Promise.all([
        this.cleanupExpiredRefreshTokens(),
        this.cleanupExpiredVerificationTokens(),
        this.cleanupExpiredResetTokens()
      ]);
      
      logger.info('Initial cleanup completed');
    } catch (error) {
      logger.error('Initial cleanup failed:', error);
    }
  }

  async cleanupExpiredRefreshTokens() {
    const timer = this.startTimer('refresh_tokens_cleanup');
    
    try {
      const query = `
        DELETE FROM refresh_tokens 
        WHERE expires_at < NOW()
        RETURNING id
      `;
      
      const result = await pool.query(query);
      const deletedCount = result.rows.length;
      
      if (deletedCount > 0) {
        logger.info({
          event: 'cleanup_refresh_tokens',
          deletedCount,
          duration: timer.end()
        });
      }
      
    } catch (error) {
      logger.error('Error cleaning up expired refresh tokens:', error);
    }
  }

  async cleanupExpiredVerificationTokens() {
    const timer = this.startTimer('verification_tokens_cleanup');
    
    try {
      // Clean up verification_tokens table
      const verificationQuery = `
        DELETE FROM verification_tokens 
        WHERE expires_at < NOW()
        RETURNING id
      `;
      
      const verificationResult = await pool.query(verificationQuery);
      const verificationDeletedCount = verificationResult.rows.length;
      
      // Also clean up users table verification fields
      const usersQuery = `
        UPDATE users 
        SET verification_token = NULL, 
            verification_expires_at = NULL
        WHERE verification_expires_at < NOW()
        RETURNING id
      `;
      
      const usersResult = await pool.query(usersQuery);
      const usersCleanedCount = usersResult.rows.length;
      
      if (verificationDeletedCount > 0 || usersCleanedCount > 0) {
        logger.info({
          event: 'cleanup_verification_tokens',
          verificationDeletedCount,
          usersCleanedCount,
          duration: timer.end()
        });
      }
      
    } catch (error) {
      logger.error('Error cleaning up expired verification tokens:', error.message);
      logger.error('Full error object:', error);
    }
  }

  async cleanupExpiredResetTokens() {
    const timer = this.startTimer('reset_tokens_cleanup');
    
    try {
      // Clean up reset_tokens table
      const resetQuery = `
        DELETE FROM reset_tokens 
        WHERE expires_at < NOW()
        RETURNING id
      `;
      
      const resetResult = await pool.query(resetQuery);
      const resetDeletedCount = resetResult.rows.length;
      
      // Also clean up users table reset fields
      const usersQuery = `
        UPDATE users 
        SET reset_token = NULL, 
            reset_token_expires_at = NULL
        WHERE reset_token_expires_at < NOW()
        RETURNING id
      `;
      
      const usersResult = await pool.query(usersQuery);
      const usersCleanedCount = usersResult.rows.length;
      
      if (resetDeletedCount > 0 || usersCleanedCount > 0) {
        logger.info({
          event: 'cleanup_reset_tokens',
          resetDeletedCount,
          usersCleanedCount,
          duration: timer.end()
        });
      }
      
    } catch (error) {
      logger.error('Error cleaning up expired reset tokens:', error.message);
      logger.error('Full error object:', error);
    }
  }

  async cleanupExpiredRedisKeys() {
    if (!redisClient.isConnected) {
      return;
    }

    const timer = this.startTimer('redis_keys_cleanup');
    
    try {
      // Redis automatically expires keys with TTL
      // This is more of a health check and metrics collection
      const info = await redisClient.client.info('keyspace');
      const dbInfo = info.split('\r\n')[1]; // Get db0 info
      
      logger.debug({
        event: 'redis_keyspace_info',
        info: dbInfo,
        duration: timer.end()
      });
      
    } catch (error) {
      logger.error('Error checking Redis keyspace:', error);
    }
  }

  async logSystemMetrics() {
    const timer = this.startTimer('system_metrics');
    
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Database metrics
      const dbResult = await pool.query(`
        SELECT 
          COUNT(*) as total_connections,
          COUNT(*) FILTER (WHERE state = 'active') as active_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      // Redis metrics
      const redisInfo = redisClient.isConnected ? 
        await redisClient.client.info('memory') : null;
      
      const metrics = {
        event: 'system_metrics',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024) // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        database: {
          totalConnections: parseInt(dbResult.rows[0].total_connections),
          activeConnections: parseInt(dbResult.rows[0].active_connections)
        },
        redis: {
          connected: redisClient.isConnected,
          info: redisInfo
        },
        duration: timer.end()
      };
      
      logger.info(metrics);
      
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  startTimer(label) {
    const startTime = process.hrtime.bigint();
    
    return {
      end: () => {
        const endTime = process.hrtime.bigint();
        return Number(endTime - startTime) / 1000000; // Convert to milliseconds
      }
    };
  }

  // Get job status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.intervals.keys()),
      redisConnected: redisClient.isConnected,
      databaseConnected: pool.totalCount > 0
    };
  }
}

// Singleton instance
const backgroundJobs = new BackgroundJobs();

module.exports = backgroundJobs;
