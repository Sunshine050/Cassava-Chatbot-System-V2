const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

const logger = require('./config/logger');
const database = require('./config/database');

const webhookRoutes = require('./routes/webhook');
const askRoutes = require('./routes/ask');
const uploadRoutes = require('./routes/upload-doc');
const logsRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
});

const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    logger.warnMessage(`Rate limit exceeded for IP ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000),
    });
  }
};

// Security & Compression
app.use(helmet());
app.use(compression());

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5174',
  'http://localhost:3000',
  'https://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Middleware
app.use(logger.requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.set('trust proxy', 1);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    database: database.isConnected() ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// --- async wrapper for routes ---
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// API Routes
app.use('/api', rateLimitMiddleware);
app.use('/api/webhook', asyncHandler(webhookRoutes));
app.use('/api/ask', asyncHandler(askRoutes));
app.use('/api/upload-doc', asyncHandler(uploadRoutes));
app.use('/api/logs', asyncHandler(logsRoutes));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Global error handling
app.use((err, req, res, next) => {
  logger.logError(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down...`);
  try {
    await database.disconnect();
    logger.info('Database disconnected successfully');
    process.exit(0);
  } catch (error) {
    logger.logError(error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => logger.logError(error, { context: 'uncaught exception' }));
process.on('unhandledRejection', (reason, promise) => logger.logError(new Error('Unhandled Rejection'), { reason, promise }));

// Start server
async function startServer() {
  try {
    await database.connect();
    logger.info('✅ Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Dashboard: http://localhost:5173`);
        console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'server initialization' });
    process.exit(1);
  }
}

startServer();
