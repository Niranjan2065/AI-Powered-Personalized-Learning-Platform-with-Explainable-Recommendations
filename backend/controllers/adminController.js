// ============================================================
// controllers/adminController.js - Admin Dashboard Controller
// ============================================================

const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const Recommendation = require('../models/Recommendation');

// ✅ Helper: matches both "tutor" and "teacher" roles consistently
const TUTOR_ROLES = { $in: ['tutor', 'teacher'] };

// @desc  Get platform-wide stats
// @route GET /api/admin/stats
// @access Private (Admin)
const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalTutors,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalQuizAttempts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      // ✅ FIX: Count both "tutor" and "teacher" roles so newly registered
      // tutors (who may have role "teacher") are included in the count.
      User.countDocuments({ role: TUTOR_ROLES }),
      Course.countDocuments(),
      Course.countDocuments({ isPublished: true }),
      Enrollment.countDocuments(),
      Result.countDocuments(),
    ]);

    // New users in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    // Average quiz score
    const avgScoreAgg = await Result.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$scorePercentage' } } },
    ]);
    const avgScore = avgScoreAgg[0]?.avgScore ? Math.round(avgScoreAgg[0].avgScore) : 0;

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, students: totalStudents, tutors: totalTutors, newLast30Days: newUsers },
        courses: { total: totalCourses, published: publishedCourses, draft: totalCourses - publishedCourses },
        enrollments: { total: totalEnrollments },
        quizzes: { totalAttempts: totalQuizAttempts, averageScore: avgScore },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all users
// @route GET /api/admin/users
// @access Private (Admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 50, search } = req.query;

    const query = {};

    // ✅ FIX: When filtering by role "tutor", also include "teacher" role users
    // so that all instructor-type users appear regardless of which role string
    // was assigned at registration.
    if (role && role !== 'all') {
      if (role === 'tutor') {
        query.role = TUTOR_ROLES;
      } else {
        query.role = role;
      }
    }

    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ FIX: Increased default limit from 20 → 50 so newly created users
    // are not cut off on the first page of the admin dashboard.
    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password'),
      User.countDocuments(query),
    ]);

    res.status(200).json({ success: true, count: users.length, total, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc  Toggle user active status
// @route PUT /api/admin/users/:id/toggle-status
// @access Private (Admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot deactivate admin' });

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      data: { isActive: user.isActive },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all courses (admin view)
// @route GET /api/admin/courses
// @access Private (Admin)
const getAllCourses = async (req, res, next) => {
  try {
    // ✅ FIX: Removed no filter — fetches ALL courses (published + draft)
    // so newly created courses by tutors always appear in the admin view.
    const courses = await Course.find()
      .populate('tutor', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    next(error);
  }
};

// @desc  Get student performance overview (admin)
// @route GET /api/admin/performance
// @access Private (Admin)
const getPerformanceOverview = async (req, res, next) => {
  try {
    // Top performing students
    const topStudents = await Result.aggregate([
      { $group: { _id: '$student', avgScore: { $avg: '$scorePercentage' }, quizzesTaken: { $sum: 1 } } },
      { $sort: { avgScore: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $project: { 'student.name': 1, 'student.email': 1, avgScore: { $round: ['$avgScore', 1] }, quizzesTaken: 1 } },
    ]);

    // Most enrolled courses
    const popularCourses = await Enrollment.aggregate([
      { $group: { _id: '$course', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
      { $unwind: '$course' },
      { $project: { 'course.title': 1, 'course.category': 1, count: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: { topStudents, popularCourses },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlatformStats, getAllUsers, toggleUserStatus, getAllCourses, getPerformanceOverview };