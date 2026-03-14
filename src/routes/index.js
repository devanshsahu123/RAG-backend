const express = require('express');
const router = express.Router();
const controller = require('../controllers');
const authRoutes = require('./auth');
const uploadRoutes = require('./upload');



// Vector DB status
router.get('/vectordb/status', controller.getVectorDbStatus);

// Auth routes  →  /api/auth/register  /api/auth/login  /api/auth/me
router.use('/auth', authRoutes);

// Upload routes  →  /api/upload  /api/upload/documents
router.use('/upload', uploadRoutes);

module.exports = router;
