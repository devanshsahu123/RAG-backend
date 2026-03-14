const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const pdfParse = require('pdf-parse');

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

// ── POST /api/upload ─────────────────────────────────────────────
const uploadDocument = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded or invalid file type. Only PDF files are accepted.',
        });
      }

      // 1. Save document record with "processing" status
      const doc = await Document.create({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        status: 'processing',
      });

      // 2. Respond immediately — don't block on PDF parsing
      res.status(201).json({
        status: 'success',
        message: 'File uploaded successfully. Text extraction is in progress.',
        data: { document: doc },
      });

      // 3. Extract text from PDF asynchronously (after response is sent)
      processPdf(doc._id, req.file.path);

    } catch (err) {
      next(err);
    }
  },
];

/**
 * Parses the PDF, stores the extracted text in MongoDB, and sets the status to "ready".
 * Runs asynchronously after the HTTP response has already been sent.
 */
async function processPdf(documentId, filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[processPdf] File not found: ${filePath}`);
      await Document.findByIdAndUpdate(documentId, { status: 'error' });
      return;
    }

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    const extractedText = pdfData.text || '';
    const pageCount = pdfData.numpages || 0;

    if (extractedText.trim().length === 0) {
      console.warn(`[processPdf] No text extracted from document ${documentId}. May be a scanned PDF.`);
    }

    await Document.findByIdAndUpdate(documentId, {
      status: 'ready',
      extractedText,
      pageCount,
    });

    console.log(`[processPdf] Done: doc_id=${documentId}, pages=${pageCount}, chars=${extractedText.length}`);
  } catch (error) {
    console.error(`[processPdf] Error processing document ${documentId}:`, error.message);
    await Document.findByIdAndUpdate(documentId, { status: 'error' });
  }
}

// ── GET /api/upload/documents ─────────────────────────────────────
const getDocuments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };

    const totalDocuments = await Document.countDocuments(query);
    // Exclude the potentially large extractedText field from the list response
    const documents = await Document.find(query, { extractedText: 0 })
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
          hasMore: skip + documents.length < totalDocuments,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/upload/documents/:id/download ─────────────────────────
const downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, userId: req.user.id });

    if (!document) {
      return res.status(404).json({ status: 'error', message: 'Document not found or unauthorized.' });
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ status: 'error', message: 'File no longer exists on the server.' });
    }

    res.download(document.path, document.originalName, (err) => {
      if (err && !res.headersSent) {
        console.error('Download error:', err);
        res.status(500).json({ status: 'error', message: 'Error downloading file.' });
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/upload/documents/:id ──────────────────────────────
const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, userId: req.user.id });

    if (!document) {
      return res.status(404).json({ status: 'error', message: 'Document not found or unauthorized.' });
    }

    // Remove physical file from disk (ignore error if already gone)
    try {
      if (fs.existsSync(document.path)) {
        fs.unlinkSync(document.path);
      }
    } catch (fsErr) {
      console.error('Error removing file from disk:', fsErr.message);
    }

    await Document.findByIdAndDelete(req.params.id);

    res.status(200).json({ status: 'success', message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadDocument, getDocuments, downloadDocument, deleteDocument };
