const pool = require('../config/db');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// Metrics collection
const getMetrics = async () => {
  const startTime = Date.now();
  
  try {
    // System metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Database metrics
    const dbMetrics = await getDatabaseMetrics();
    
    // Redis metrics
    const redisMetrics = await getRedisMetrics();
    
    // Application metrics
    const appMetrics = getApplicationMetrics();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: {
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
        loadAverage: require('os').loadavg()
      },
      database: dbMetrics,
      redis: redisMetrics,
      application: appMetrics,
      responseTime: Date.now() - startTime
    };
    
    return metrics;
    
  } catch (error) {
    logger.error('Error collecting metrics:', error);
    throw error;
  }
};

// Database metrics
const getDatabaseMetrics = async () => {
  try {
    const queries = [
      // Connection stats
      `SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections
       FROM pg_stat_activity 
       WHERE datname = current_database()`,
      
      // Table sizes
      `SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
       FROM pg_tables 
       WHERE schemaname = 'public'
       ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC`,
      
      // User count
      `SELECT COUNT(*) as total_users FROM users`,
      
      // Active refresh tokens
      `SELECT COUNT(*) as active_refresh_tokens 
       FROM refresh_tokens 
       WHERE expires_at > NOW()`,
      
      // Unverified users
      `SELECT COUNT(*) as unverified_users 
       FROM users 
       WHERE is_verified = FALSE`
    ];
    
    const results = await Promise.all(
      queries.map(query => pool.query(query))
    );
    
    return {
      connections: {
        total: parseInt(results[0].rows[0].total_connections),
        active: parseInt(results[0].rows[0].active_connections),
        idle: parseInt(results[0].rows[0].idle_connections)
      },
      tables: results[1].rows.map(row => ({
        name: row.tablename,
        size: row.size,
        sizeBytes: row.size_bytes
      })),
      users: {
        total: parseInt(results[2].rows[0].total_users),
        unverified: parseInt(results[4].rows[0].unverified_users)
      },
      refreshTokens: {
        active: parseInt(results[3].rows[0].active_refresh_tokens)
      }
    };
    
  } catch (error) {
    logger.error('Error getting database metrics:', error);
    return { error: error.message };
  }
};

// Redis metrics
const getRedisMetrics = async () => {
  try {
    if (!redisClient.isConnected) {
      return { connected: false };
    }
    
    const info = await redisClient.client.info();
    const lines = info.split('\r\n');
    const metrics = { connected: true };
    
    // Parse Redis info
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        
        switch (key) {
          case 'used_memory':
            metrics.memoryUsed = parseInt(value);
            break;
          case 'used_memory_human':
            metrics.memoryUsedHuman = value;
            break;
          case 'connected_clients':
            metrics.connectedClients = parseInt(value);
            break;
          case 'total_commands_processed':
            metrics.totalCommands = parseInt(value);
            break;
          case 'keyspace_hits':
            metrics.keyspaceHits = parseInt(value);
            break;
          case 'keyspace_misses':
            metrics.keyspaceMisses = parseInt(value);
            break;
          case 'uptime_in_seconds':
            metrics.uptime = parseInt(value);
            break;
        }
      }
    });
    
    // Calculate hit rate
    if (metrics.keyspaceHits && metrics.keyspaceMisses) {
      metrics.hitRate = (
        metrics.keyspaceHits / (metrics.keyspaceHits + metrics.keyspaceMisses) * 100
      ).toFixed(2);
    }
    
    return metrics;
    
  } catch (error) {
    logger.error('Error getting Redis metrics:', error);
    return { connected: false, error: error.message };
  }
};

// Application metrics
const getApplicationMetrics = () => {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000
  };
};

// Metrics endpoint handler
const metricsHandler = async (req, res) => {
  try {
    const metrics = await getMetrics();
    
    res.status(200).json({
      status: 'ok',
      metrics
    });
    
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to collect metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Prometheus metrics format (optional for monitoring systems)
const prometheusMetricsHandler = async (req, res) => {
  try {
    const metrics = await getMetrics();
    
    // Convert to Prometheus format
    const prometheusFormat = [
      `# HELP nodejs_memory_bytes Node.js memory usage in bytes`,
      `# TYPE nodejs_memory_bytes gauge`,
      `nodejs_memory_bytes{type="rss"} ${metrics.system.memory.rss * 1024 * 1024}`,
      `nodejs_memory_bytes{type="heap_used"} ${metrics.system.memory.heapUsed * 1024 * 1024}`,
      `nodejs_memory_bytes{type="heap_total"} ${metrics.system.memory.heapTotal * 1024 * 1024}`,
      
      `# HELP nodejs_uptime_seconds Node.js uptime in seconds`,
      `# TYPE nodejs_uptime_seconds counter`,
      `nodejs_uptime_seconds ${metrics.uptime}`,
      
      `# HELP database_connections_active Active database connections`,
      `# TYPE database_connections_active gauge`,
      `database_connections_active ${metrics.database.connections.active}`,
      
      `# HELP database_connections_total Total database connections`,
      `# TYPE database_connections_total gauge`,
      `database_connections_total ${metrics.database.connections.total}`,
      
      `# HELP redis_connected Redis connection status`,
      `# TYPE redis_connected gauge`,
      `redis_connected ${metrics.redis.connected ? 1 : 0}`,
      
      `# HELP users_total Total number of users`,
      `# TYPE users_total gauge`,
      `users_total ${metrics.database.users.total}`,
      
      `# HELP refresh_tokens_active Active refresh tokens`,
      `# TYPE refresh_tokens_active gauge`,
      `refresh_tokens_active ${metrics.database.refreshTokens.active}`
    ].join('\n') + '\n';
    
    res.set('Content-Type', 'text/plain');
    res.status(200).send(prometheusFormat);
    
  } catch (error) {
    logger.error('Prometheus metrics endpoint error:', error);
    res.status(500).send('# Error collecting metrics\n');
  }
};

module.exports = {
  getMetrics,
  metricsHandler,
  prometheusMetricsHandler
};
