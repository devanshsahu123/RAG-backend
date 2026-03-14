const Document = require('../models/Document');
const { generateChatResponse } = require('../services/aiService');

/**
 * POST /api/chat
 * Body: { documentId: string, message: string }
 * Auth: Bearer token required
 */
const chatWithDocument = async (req, res, next) => {
  try {
    const { documentId, message } = req.body;

    // --- Validation ---
    if (!documentId || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Both "documentId" and "message" fields are required.',
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message cannot be empty.',
      });
    }

    // --- Fetch Document ---
    const doc = await Document.findOne({ _id: documentId, userId: req.user.id });

    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found or you do not have access to it.',
      });
    }

    // --- Verify document is ready ---
    if (doc.status === 'processing') {
      return res.status(202).json({
        status: 'error',
        message: 'This document is still being processed. Please wait a moment and try again.',
      });
    }

    if (doc.status === 'error') {
      return res.status(422).json({
        status: 'error',
        message: 'This document failed to process and cannot be queried.',
      });
    }

    // --- Extract text check ---
    if (!doc.extractedText || doc.extractedText.trim().length === 0) {
      return res.status(422).json({
        status: 'error',
        message: 'No text could be extracted from this document. It may be a scanned image PDF.',
      });
    }

    // --- Generate AI Response ---
    const reply = await generateChatResponse(doc.extractedText, message.trim());

    res.status(200).json({
      status: 'success',
      data: { reply },
    });

  } catch (err) {
    // Friendly error for missing API key
    if (err.message && err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({
        status: 'error',
        message: err.message,
      });
    }
    next(err);
  }
};

module.exports = { chatWithDocument };
