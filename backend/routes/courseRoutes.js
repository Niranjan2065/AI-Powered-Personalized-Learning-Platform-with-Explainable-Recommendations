// ============================================================
// routes/courseRoutes.js
// ============================================================
const express = require('express');
const router = express.Router();
const {
  getCourses, getCourse, createCourse, updateCourse,
  deleteCourse, togglePublish, getMyCourses,
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

// Nested routes - modules inside courses
const { getModules, createModule } = require('../controllers/moduleController');

router.get('/', getCourses);
router.get('/my-courses', protect, authorize('tutor', 'admin'), getMyCourses);
router.get('/:id', getCourse);
router.post('/', protect, authorize('tutor', 'admin'), createCourse);
router.put('/:id', protect, authorize('tutor', 'admin'), updateCourse);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteCourse);
router.put('/:id/publish', protect, authorize('tutor', 'admin'), togglePublish);

// Nested: modules for a course
router.get('/:courseId/modules', getModules);
router.post('/:courseId/modules', protect, authorize('tutor', 'admin'), createModule);

module.exports = router;
