// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getPlatformStats, getAllUsers, toggleUserStatus, getAllCourses, getPerformanceOverview } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes protected
router.use(protect, authorize('admin'));

router.get('/stats', getPlatformStats);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.get('/courses', getAllCourses);
router.get('/performance', getPerformanceOverview);

module.exports = router;
