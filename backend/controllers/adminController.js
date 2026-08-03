// controllers/adminController.js — Fixed to use QuizAttempt instead of Result
// Phase 4 update: getAllUsers now populates tutorApplication so the admin
// dashboard can show the "📋 Application" button only when one exists.
const User           = require('../models/User');
const Course         = require('../models/Course');
const Enrollment     = require('../models/Enrollment');
const QuizAttempt    = require('../models/QuizAttempt');
const Recommendation = require('../models/Recommendation');

const TUTOR_ROLES = { $in: ['tutor', 'teacher'] };

// GET /api/admin/stats
const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalUsers, totalStudents, totalTutors,
      totalCourses, publishedCourses, totalEnrollments, totalQuizAttempts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: TUTOR_ROLES }),
      Course.countDocuments(),
      Course.countDocuments({ isPublished: true }),
      Enrollment.countDocuments(),
      QuizAttempt.countDocuments(),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    const avgScoreAgg = await QuizAttempt.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$score' } } },
    ]);
    const avgScore = avgScoreAgg[0]?.avgScore
      ? Math.round(avgScoreAgg[0].avgScore) : 0;

    res.status(200).json({
      success: true,
      data: {
        users:       { total: totalUsers, students: totalStudents, tutors: totalTutors, newLast30Days: newUsers },
        courses:     { total: totalCourses, published: publishedCourses, draft: totalCourses - publishedCourses },
        enrollments: { total: totalEnrollments },
        quizzes:     { totalAttempts: totalQuizAttempts, averageScore: avgScore },
      },
    });
  } catch (error) { next(error); }
};

// GET /api/admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 50, search } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role === 'tutor' ? TUTOR_ROLES : role;
    }
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password')
        // ── FIX: populate tutorApplication so the dashboard can show the
        //    "📋 Application" button only when a document actually exists.
        //    Tutors registered before this feature will have null here,
        //    and the button will be hidden automatically.
        .populate('tutorApplication', '_id status areaOfExpertise'),
      User.countDocuments(query),
    ]);

    res.status(200).json({ success: true, count: users.length, total, data: users });
  } catch (error) { next(error); }
};

// PUT /api/admin/users/:id/toggle-status
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate admin' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      data:    { isActive: user.isActive },
    });
  } catch (error) { next(error); }
};

// GET /api/admin/courses
const getAllCourses = async (req, res, next) => {
  try {
    const courses = await Course.find()
      .populate('tutor', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: courses.length, data: courses });
  } catch (error) { next(error); }
};

// GET /api/admin/performance
const getPerformanceOverview = async (req, res, next) => {
  try {
    const topStudents = await QuizAttempt.aggregate([
      { $group: { _id: '$student', avgScore: { $avg: '$score' }, quizzesTaken: { $sum: 1 } } },
      { $sort: { avgScore: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $project: {
        'student.name': 1, 'student.email': 1,
        avgScore: { $round: ['$avgScore', 1] }, quizzesTaken: 1,
      }},
    ]);

    const popularCourses = await Enrollment.aggregate([
      { $group: { _id: '$course', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
      { $unwind: '$course' },
      { $project: { 'course.title': 1, 'course.category': 1, count: 1 } },
    ]);

    const recentAttempts = await QuizAttempt.find()
      .populate('student', 'name')
      .populate('quiz', 'title')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('student quiz score isPassed createdAt');

    res.status(200).json({
      success: true,
      data: { topStudents, popularCourses, recentActivity: recentAttempts },
    });
  } catch (error) { next(error); }
};

module.exports = {
  getPlatformStats,
  getAllUsers,
  toggleUserStatus,
  getAllCourses,
  getPerformanceOverview,
  getWeakTopicsReport,
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/weak-topics-report
// Aggregates `weakTopics` across every QuizAttempt in the platform to rank
// topics by how often students actually fail them — used to prioritize
// which topics get curated external resources added to
// ai_engine/data/raw/topic_resources.json next, instead of guessing.
//
// `weakTopics` has been correctly populated on every QuizAttempt since
// scoreAttempt() was written (it reads q.topic directly from the quiz
// question, independent of the topicPerformance/scoredAnswers bug fixed
// separately) — so this works retroactively on existing historical data,
// no migration needed.
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// GET /api/admin/weak-topics-report
// Thin wrapper around topicResourceService.getCoverageReport() — see that
// function for why it joins through Quiz.questions rather than
// QuizAttempt.weakTopics (retroactive correctness across historical data).
// ─────────────────────────────────────────────────────────────
async function getWeakTopicsReport(req, res, next) {
  try {
    const { getCoverageReport } = require('../services/topicResourceService');
    const report = await getCoverageReport();
    const needsCuration = report.filter(r => !r.covered);

    res.status(200).json({
      success: true,
      data: {
        report,          // full list — uncovered topics first, then worst fail rate first
        needsCuration,    // subset with no resources yet — the actual TODO list
      },
    });
  } catch (error) { next(error); }
}