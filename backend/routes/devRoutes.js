// ============================================================
// routes/devRoutes.js - Development-only data viewer
// ============================================================
// Access at: http://localhost:5000/api/dev/data
// Shows all data in the database — ONLY available in development
// ============================================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const Recommendation = require('../models/Recommendation');

// Guard: only in development
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ success: false, message: 'Dev routes disabled in production' });
  }
  next();
});

// GET /api/dev/data — all collections
router.get('/data', async (req, res) => {
  const [users, courses, modules, lessons, quizzes, enrollments, results, recommendations] = await Promise.all([
    User.find().select('-password').lean(),
    Course.find().populate('tutor', 'name email').lean(),
    Module.find().lean(),
    Lesson.find().lean(),
    Quiz.find().lean(),
    Enrollment.find().lean(),
    Result.find().lean(),
    Recommendation.find().lean(),
  ]);

  res.status(200).json({
    success: true,
    message: '📦 Development Data Viewer — All Collections',
    counts: {
      users: users.length, courses: courses.length, modules: modules.length,
      lessons: lessons.length, quizzes: quizzes.length, enrollments: enrollments.length,
      results: results.length, recommendations: recommendations.length,
    },
    data: { users, courses, modules, lessons, quizzes, enrollments, results, recommendations },
  });
});

// GET /api/dev/users — just users
router.get('/users', async (req, res) => {
  const users = await User.find().select('-password').lean();
  res.json({ success: true, count: users.length, data: users });
});

// GET /api/dev/reset — drop all data (useful for fresh seed)
router.delete('/reset', async (req, res) => {
  await Promise.all([
    User.deleteMany(), Course.deleteMany(), Module.deleteMany(),
    Lesson.deleteMany(), Quiz.deleteMany(), Enrollment.deleteMany(),
    Result.deleteMany(), Recommendation.deleteMany(),
  ]);
  res.json({ success: true, message: '🗑️ All data cleared. Run npm run seed to repopulate.' });
});

module.exports = router;