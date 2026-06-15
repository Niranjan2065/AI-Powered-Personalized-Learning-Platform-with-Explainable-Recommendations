// routes/applicationRoutes.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');

const {
  getAllApplications,
  getApplication,
  updateApplicationStatus,
  getMyApplication,
  deleteApplication,
} = require('../controllers/applicationController');

const { protect, authorize } = require('../middleware/auth');

// ── Resume upload config ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/resumes/'),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e9)}`;
    cb(null, `resume-${unique}${path.extname(file.originalname)}`);
  },
});
const resumeUpload = multer({
  storage,
  limits:      { fileSize: 5 * 1024 * 1024 },   // 5 MB cap
  fileFilter:  (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Resume must be PDF, DOC, or DOCX'));
    }
  },
});

// ── Applicant routes ──────────────────────────────────────────────────────────
router.get('/my', protect, getMyApplication);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get ('/',          protect, authorize('admin'), getAllApplications);
router.get ('/:id',       protect, authorize('admin'), getApplication);
router.patch('/:id/status', protect, authorize('admin'), updateApplicationStatus);
router.delete('/:id',     protect, authorize('admin'), deleteApplication);

// Export resumeUpload so authRoutes.js can use it for the register endpoint
module.exports = { router, resumeUpload };