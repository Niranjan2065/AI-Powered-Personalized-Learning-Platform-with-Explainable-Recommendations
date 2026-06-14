// routes/recommendationRoutes.js — Phase 12: added SR review-due route
const express = require('express');
const router  = express.Router();

const {
  generateMyRecommendations,
  getMyRecommendations,
  getReviewDue,             // ← Step 2: SR review queue
  getMyAnalysis,
  dismissRecommendation,
  getAllRecommendations,
  triggerTraining,
  getMLStatus,
} = require('../controllers/recommendationController');

const { protect, authorize } = require('../middleware/auth');

// ── Student routes ────────────────────────────────────────────────────────
router.post('/generate',                   protect, authorize('student'), generateMyRecommendations);
router.get ('/my',                         protect, authorize('student'), getMyRecommendations);
router.get ('/review-due',                 protect, authorize('student'), getReviewDue);
router.get ('/analysis',                   protect, authorize('student'), getMyAnalysis);
router.put ('/:recId/item/:itemId/dismiss',protect, authorize('student'), dismissRecommendation);

// ── Admin routes ──────────────────────────────────────────────────────────
router.get ('/admin/all',  protect, authorize('admin'), getAllRecommendations);
router.post('/ml-train',   protect, authorize('admin'), triggerTraining);
router.get ('/ml-status',  protect, authorize('admin'), getMLStatus);

module.exports = router;