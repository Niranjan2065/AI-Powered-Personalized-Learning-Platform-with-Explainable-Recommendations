// routes/enrollmentRoutes.js
const express = require('express');
const router = express.Router();
const { enrollCourse, getMyEnrollments, getEnrollment, unenrollCourse, getCourseEnrollments, updateProgress } = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/my', protect, authorize('student'), getMyEnrollments);
router.get('/course/:courseId', protect, authorize('tutor', 'admin'), getCourseEnrollments);
router.post('/:courseId', protect, authorize('student'), enrollCourse);
router.get('/:courseId', protect, authorize('student'), getEnrollment);
router.delete('/:courseId', protect, authorize('student'), unenrollCourse);
router.put('/:courseId/progress', protect, authorize('student'), updateProgress);

module.exports = router;
