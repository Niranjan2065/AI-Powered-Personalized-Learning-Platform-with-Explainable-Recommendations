// routes/recommendationRoutes.js — Phase 12 + Feedback loop
const express = require('express');
const router  = express.Router();

const {
  generateMyRecommendations,
  getMyRecommendations,
  getReviewDue,
  getMyAnalysis,
  dismissRecommendation,
  getAllRecommendations,
  triggerTraining,
  getMLStatus,
} = require('../controllers/recommendationController');

const {
  submitFeedback,
  getFeedbackSummary,
  getMyFeedback,
} = require('../controllers/feedbackController');

const { protect, authorize } = require('../middleware/auth');

// ── Student routes ────────────────────────────────────────────────────────────
router.post('/generate',                        protect, authorize('student'), generateMyRecommendations);
router.get ('/my',                              protect, authorize('student'), getMyRecommendations);
router.get ('/review-due',                      protect, authorize('student'), getReviewDue);
router.get ('/analysis',                        protect, authorize('student'), getMyAnalysis);
router.put ('/:recId/item/:itemId/dismiss',     protect, authorize('student'), dismissRecommendation);

// ── Feedback routes ───────────────────────────────────────────────────────────
router.post('/feedback/summary',                protect, authorize('student'), getFeedbackSummary);  // POST so engine can call it internally
router.get ('/feedback/summary',                protect, authorize('student'), getFeedbackSummary);
router.get ('/feedback/my',                     protect, authorize('student'), getMyFeedback);
router.post('/:recId/items/:itemId/feedback',   protect, authorize('student'), submitFeedback);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get ('/admin/all',  protect, authorize('admin'), getAllRecommendations);
router.post('/ml-train',   protect, authorize('admin'), triggerTraining);
router.get ('/ml-status',  protect, authorize('admin'), getMLStatus);

module.exports = router;