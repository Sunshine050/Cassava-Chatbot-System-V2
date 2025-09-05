const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cassava-chatbot' },
  transports: [
    // Console logs only info and above in production, debug in dev
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
    }),

    // All logs to file
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      level: 'info'
    }),

    // Error logs to separate file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  exitOnError: false
});

// Middleware for HTTP request logging
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request Failed', logData);
    } else if (process.env.NODE_ENV === 'development') {
      // Log successful requests only in dev
      logger.info('HTTP Request', logData);
    }
  });
  next();
};

// General error logging
logger.logError = (error, context = {}) => {
  // Skip MongoDB deprecation warnings
  if (error.message?.includes('deprecated option')) return;

  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

// API call logging
logger.logApiCall = (service, endpoint, duration, success, details = {}) => {
  const logData = {
    service,
    endpoint,
    duration: `${duration}ms`,
    success,
    ...details
  };
  if (success) {
    if (process.env.NODE_ENV === 'development') {
      logger.info('External API Call Success', logData);
    }
  } else {
    logger.warn('External API Call Failed', logData);
  }
};

module.exports = logger;
