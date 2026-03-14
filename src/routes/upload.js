const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, downloadDocument, deleteDocument } = require('../controllers/uploadController');
const authMiddleware = require('../middlewares/authMiddleware');

// All upload routes require authentication
router.post('/', authMiddleware, uploadDocument);
router.get('/documents', authMiddleware, getDocuments);
router.get('/documents/:id/download', authMiddleware, downloadDocument);
router.delete('/documents/:id', authMiddleware, deleteDocument);

module.exports = router;
