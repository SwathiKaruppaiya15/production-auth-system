const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

const logger = pino({
  level: logLevel,
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
    log: (object) => {
      // Remove sensitive data from logs
      if (object.password) {
        object.password = '[REDACTED]';
      }
      if (object.token) {
        object.token = '[REDACTED]';
      }
      if (object.refreshToken) {
        object.refreshToken = '[REDACTED]';
      }
      return object;
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
