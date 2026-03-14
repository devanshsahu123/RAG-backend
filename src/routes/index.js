const express = require('express');
const router = express.Router();
const controller = require('../controllers');

// Base API route
router.get('/health', (req, res) => {
  res.json({ status: 'API is healthy' });
});

// Vector DB test route
router.get('/vectordb/status', controller.getVectorDbStatus);

module.exports = router;
