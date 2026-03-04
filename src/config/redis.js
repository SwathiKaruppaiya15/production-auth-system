const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.enabled = process.env.REDIS_ENABLED !== 'false' && process.env.NODE_ENV === 'production';
  }

  async connect() {
    // Skip Redis connection if not enabled
    if (!this.enabled) {
      logger.info('Redis is disabled in development mode');
      return;
    }

    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        },
        // Auto-reconnect configuration
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        // Connection timeout
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        logger.info(`Redis reconnecting... Attempt ${this.reconnectAttempts}`);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max Redis reconnection attempts reached');
          this.client.disconnect();
        }
      });

      // Connect to Redis
      await this.client.connect();
      
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      // Don't throw error in development
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  // Rate limiting operations
  async incrementRateLimit(key, windowMs, maxRequests) {
    if (!this.enabled || !this.isConnected) {
      // Fallback to unlimited if Redis is not available
      return { count: 0, remaining: maxRequests };
    }

    try {
      const pipeline = this.client.pipeline();
      
      // Increment counter
      pipeline.incr(key);
      
      // Set expiration if new key
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results[0][1];
      const remaining = Math.max(0, maxRequests - count);
      
      return { count, remaining };
    } catch (error) {
      logger.error('Redis rate limit error:', error);
      return { count: 0, remaining: maxRequests };
    }
  }

  // Token blacklist operations
  async addToBlacklist(token, expiry) {
    if (!this.enabled || !this.isConnected) return false;
    
    try {
      await this.client.setex(`blacklist:${token}`, expiry, '1');
      return true;
    } catch (error) {
      logger.error('Redis blacklist error:', error);
      return false;
    }
  }

  async isBlacklisted(token) {
    if (!this.enabled || !this.isConnected) return false;
    
    try {
      const result = await this.client.get(`blacklist:${token}`);
      return result === '1';
    } catch (error) {
      logger.error('Redis blacklist check error:', error);
      return false;
    }
  }

  // Health check
  async ping() {
    if (!this.enabled || !this.isConnected) return false;
    
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping error:', error);
      return false;
    }
  }

  // Get connection info
  getConnectionInfo() {
    return {
      connected: this.isConnected,
      enabled: this.enabled,
      reconnectAttempts: this.reconnectAttempts,
      host: this.client?.options?.host,
      port: this.client?.options?.port
    };
  }
}

// Singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;
