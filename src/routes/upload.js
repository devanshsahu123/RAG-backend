const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments } = require('../controllers/uploadController');
const authMiddleware = require('../middlewares/authMiddleware');

// All upload routes require authentication
router.post('/', authMiddleware, uploadDocument);
router.get('/documents', authMiddleware, getDocuments);

module.exports = router;
