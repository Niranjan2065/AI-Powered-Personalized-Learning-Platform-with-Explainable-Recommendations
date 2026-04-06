// ============================================================
// routes/moduleRoutes.js
// ============================================================
const express = require('express');
const router = express.Router();

// Controllers
const {
  updateModule,
  deleteModule,
  getLessons,
  createLesson
} = require('../controllers/moduleController');

const {
  getQuizzesByLesson,   // ✅ FIXED NAME
  createQuiz
} = require('../controllers/quizController');

// Middleware
const { protect, authorize } = require('../middleware/auth');

// ================= MODULE ROUTES =================

// Update module
router.put('/:id', protect, authorize('tutor', 'admin'), updateModule);

// Delete module
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteModule);

// ================= LESSON ROUTES =================

// Get all lessons in a module
router.get('/:moduleId/lessons', protect, getLessons);

// Create lesson in module
router.post('/:moduleId/lessons', protect, authorize('tutor', 'admin'), createLesson);

// ================= QUIZ ROUTES =================

// ✅ Get quizzes by LESSON (correct flow)
router.get('/lesson/:lessonId/quizzes', protect, getQuizzesByLesson);

// Create quiz (linked to lesson inside body)
router.post('/:moduleId/quizzes', protect, authorize('tutor', 'admin'), createQuiz);

module.exports = router;