// middleware/upload.js
// ─────────────────────────────────────────────────────────────
// Multer configuration for PDF uploads.
//
// uploadQuiz   — quiz-generation PDFs (quiz-pdfs/, temporary)
// uploadLesson — lesson attachment PDFs (lesson-pdfs/, permanent)
// ─────────────────────────────────────────────────────────────
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Shared helpers ───────────────────────────────────────────
const makeStorage = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => {
      const ts   = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}-${safe}`);
    },
  });
};

const pdfOnly = (label) => (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') return cb(null, true);
  cb(new Error(`Only PDF files are allowed${label ? ` for ${label}` : ''}.`), false);
};

// ── Quiz-generation upload (temporary, deleted after extraction) ──
const QUIZ_DIR = path.join(__dirname, '..', 'uploads', 'quiz-pdfs');

const uploadQuiz = multer({
  storage:    makeStorage(QUIZ_DIR),
  fileFilter: pdfOnly('quiz generation'),
  limits:     { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ── Lesson-attachment upload (permanent, served at /uploads/lesson-pdfs/) ──
const LESSON_PDF_DIR = path.join(__dirname, '..', 'uploads', 'lesson-pdfs');

const uploadLesson = multer({
  storage:    makeStorage(LESSON_PDF_DIR),
  fileFilter: pdfOnly('lesson attachments'),
  limits:     { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── Exports ──────────────────────────────────────────────────
// Legacy default export kept so existing quiz routes don't break
module.exports          = uploadQuiz;
module.exports.uploadQuiz   = uploadQuiz;
module.exports.uploadLesson = uploadLesson;