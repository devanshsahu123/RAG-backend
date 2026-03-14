const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');

// ── Multer storage config ──────────────────────────────────────
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── Controller ─────────────────────────────────────────────────
// POST /api/upload   (auth required)
const uploadDocument = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded or invalid file type.' });
      }

      const doc = await Document.create({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        status: 'uploaded',
      });

      res.status(201).json({
        status: 'success',
        message: 'File uploaded successfully.',
        data: { document: doc },
      });
    } catch (err) {
      next(err);
    }
  },
];

// GET /api/upload/documents  – list documents for authenticated user (with pagination)
const getDocuments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };

    const totalDocuments = await Document.countDocuments(query);
    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ 
      status: 'success', 
      data: { 
        documents,
        pagination: {
          total: totalDocuments,
          page,
          limit,
          totalPages: Math.ceil(totalDocuments / limit),
          hasMore: skip + documents.length < totalDocuments
        }
      } 
    });
  } catch (err) {
    next(err);
  }
};
// GET /api/upload/documents/:id/download - download a specific document
const downloadDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const document = await Document.findOne({ _id: documentId, userId: req.user.id });

    if (!document) {
      return res.status(404).json({ status: 'error', message: 'Document not found or unauthorized' });
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ status: 'error', message: 'File no longer exists on server' });
    }

    // Set the proper headers and download the file
    res.download(document.path, document.originalName, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ status: 'error', message: 'Error downloading file' });
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadDocument, getDocuments, downloadDocument };
