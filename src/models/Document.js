const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    size: {
      type: Number, // bytes
      required: true,
    },
    mimetype: {
      type: String,
      default: 'application/pdf',
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'error'],
      default: 'uploaded',
    },
    path: {
      type: String, // disk path where multer saved it
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
