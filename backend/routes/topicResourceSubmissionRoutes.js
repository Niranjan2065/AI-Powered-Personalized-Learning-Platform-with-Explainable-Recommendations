// routes/topicResourceSubmissionRoutes.js
const express = require('express');
const router  = express.Router();

const { protect, authorize } = require('../middleware/auth');
const {
  submitResource,
  getMySubmissions,
  getSubmissions,
  reviewSubmission,
  suggestSearches,
} = require('../controllers/topicResourceSubmissionController');

// ── Tutor-facing ───────────────────────────────────────────────────────────
router.post('/', protect, authorize('tutor', 'teacher'), submitResource);
router.get ('/mine', protect, authorize('tutor', 'teacher'), getMySubmissions);
router.post('/suggest', protect, authorize('tutor', 'teacher'), suggestSearches);

// ── Admin-facing ─────────────────────────────────────────────────────────
router.get('/admin/all',       protect, authorize('admin'), getSubmissions);
router.put('/admin/:id/review', protect, authorize('admin'), reviewSubmission);

module.exports = router;