const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_PDF_SIZE_MB || '25', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? (path.isAbsolute(process.env.UPLOAD_DIR)
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.resolve(path.join(__dirname, '..', '..', '..', process.env.UPLOAD_DIR)))
  : path.resolve(path.join(__dirname, '..', '..', '..', 'uploads'));

// Ensure the upload directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => {
    // Generate a UUID-based filename to prevent path traversal and collisions
    const safeFilename = uuidv4() + '.pdf';
    cb(null, safeFilename);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ext !== '.pdf') {
    return cb(new Error('INVALID_EXTENSION: Only .pdf files are accepted'));
  }
  if (mime !== 'application/pdf') {
    return cb(new Error('INVALID_MIME: MIME type must be application/pdf'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

module.exports = { upload, UPLOAD_DIR, MAX_FILE_SIZE_MB };
