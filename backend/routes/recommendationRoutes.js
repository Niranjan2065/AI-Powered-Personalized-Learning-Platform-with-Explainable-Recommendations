// routes/recommendationRoutes.js
const express = require('express');
const router = express.Router();
const { generateMyRecommendations, getMyRecommendations, getMyAnalysis, dismissRecommendation, getAllRecommendations } = require('../controllers/recommendationController');
const { protect, authorize } = require('../middleware/auth');

router.post('/generate', protect, authorize('student'), generateMyRecommendations);
router.get('/my', protect, authorize('student'), getMyRecommendations);
router.get('/analysis', protect, authorize('student'), getMyAnalysis);
router.put('/:recId/item/:itemId/dismiss', protect, authorize('student'), dismissRecommendation);
router.get('/admin/all', protect, authorize('admin'), getAllRecommendations);

module.exports = router;
