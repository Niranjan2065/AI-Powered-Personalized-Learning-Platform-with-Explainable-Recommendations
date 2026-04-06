// routes/quizRoutes.js
const express = require('express');
const router  = express.Router();

const { protect, authorize } = require('../middleware/auth');
const upload                 = require('../middleware/upload');

const {
  generateQuiz,
  generateFromPdf,
  saveGeneratedQuiz,
  createQuiz,
  getQuizzesByLesson,
  getQuiz,
  getQuizFull,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  submitAttempt,
  getAttempts,
  getMyAttempts,
  getCourseAnalytics,
} = require('../controllers/quizController');

const rateLimit = require('express-rate-limit');
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many AI generation requests. Wait a minute.' },
  validate: { xForwardedForHeader: false },
});

// ── FIX: changed 'instructor' → 'tutor' everywhere to match your User model ──

// AI GENERATION
router.post('/generate',         protect, authorize('tutor', 'admin'), aiLimiter, generateQuiz);
router.post('/generate-from-pdf',protect, authorize('tutor', 'admin'), aiLimiter, upload.single('pdf'), generateFromPdf);
router.post('/save-generated',   protect, authorize('tutor', 'admin'), saveGeneratedQuiz);

// ANALYTICS
router.get('/analytics/course/:courseId', protect, authorize('tutor', 'admin'), getCourseAnalytics);

// LESSON QUIZZES
router.get('/lesson/:lessonId', protect, getQuizzesByLesson);

// QUIZ CRUD
router.post('/',             protect, authorize('tutor', 'admin'), createQuiz);
router.get('/:id',           protect, getQuiz);
router.get('/:id/full',      protect, authorize('tutor', 'admin'), getQuizFull);
router.put('/:id',           protect, authorize('tutor', 'admin'), updateQuiz);
router.delete('/:id',        protect, authorize('tutor', 'admin'), deleteQuiz);
router.patch('/:id/publish', protect, authorize('tutor', 'admin'), publishQuiz);

// ATTEMPTS
router.post('/:id/attempt',    protect, submitAttempt);
router.get('/:id/attempts',    protect, authorize('tutor', 'admin'), getAttempts);
router.get('/:id/my-attempts', protect, getMyAttempts);

module.exports = router;