const mongoose = require('mongoose');

const paperSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  title: { type: String, default: null },
  authors: [{ type: String }],
  abstract: { type: String, default: null },
  publicationYear: { type: Number, default: null },
  originalFilename: { type: String, required: true },
  storedFilename: { type: String, required: true }, // UUID-based safe filename
  fileSizeBytes: { type: Number },
  status: {
    type: String,
    enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'QUEUED',
    index: true,
  },
  processingError: { type: String, default: null },
  extractedText: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Paper', paperSchema);
