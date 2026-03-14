require('dotenv').config(); // Load env vars first
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { port, mongoUri } = require('./src/config');
const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Base route
app.get('/', (req, res) => {
  res.send('Backend Server is running.');
});

// Error handling middleware
app.use(errorHandler);

// Connect to MongoDB then start server
mongoose
  .connect(mongoUri)
  .then(() => {
    logger.info('Connected to MongoDB');
    app.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;