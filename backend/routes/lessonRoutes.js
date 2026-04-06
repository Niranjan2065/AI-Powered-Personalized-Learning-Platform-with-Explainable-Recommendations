// routes/lessonRoutes.js
const express = require('express');
const router = express.Router();
const { getLesson, updateLesson, deleteLesson, markLessonComplete } = require('../controllers/moduleController');
const { protect, authorize } = require('../middleware/auth');

router.get('/:id', protect, getLesson);
router.put('/:id', protect, authorize('tutor', 'admin'), updateLesson);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteLesson);
router.post('/:id/complete', protect, authorize('student'), markLessonComplete);

module.exports = router;
