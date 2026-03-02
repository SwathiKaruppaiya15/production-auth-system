const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('./config/helmet.config');
const cors = require('./config/cors.config');
const errorHandler = require('./middleware/error.middleware');
const { generalRateLimit } = require('./middleware/rateLimit.middleware');

const routes = require('./routes');
const app = express();

// Security middleware
app.use(helmet);
app.use(cors);
app.use(generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;