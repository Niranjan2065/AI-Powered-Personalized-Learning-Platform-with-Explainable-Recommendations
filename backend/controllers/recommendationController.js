// controllers/recommendationController.js — Fixed: uses QuizAttempt (not Result)
const Recommendation = require('../models/Recommendation');
const QuizAttempt   = require('../models/QuizAttempt');
const Progress       = require('../models/Progress');
const Enrollment     = require('../models/Enrollment');
const { generateRecommendations, getLatestRecommendation, aggregateTopicPerformance } = require('../ai/recommendationEngine');
const User = require('../models/User');

// POST /api/recommendations/generate
const generateMyRecommendations = async (req, res, next) => {
  try {
    const result = await generateRecommendations(req.user._id);

    if (!result.success) {
      return res.status(200).json({ success: false, message: result.message, needsMoreData: true });
    }

    const detectedLevel = result.data.analysisSummary?.detectedLevel;
    if (detectedLevel) await User.findByIdAndUpdate(req.user._id, { learningLevel: detectedLevel });

    res.status(200).json({ success: true, message: 'Personalized learning path generated!', data: result.data });
  } catch (error) { next(error); }
};

// GET /api/recommendations/my
const getMyRecommendations = async (req, res, next) => {
  try {
    const recommendation = await getLatestRecommendation(req.user._id);
    if (!recommendation) {
      return res.status(200).json({
        success: true, data: null,
        message: 'No recommendations yet. Complete some quizzes to get personalized suggestions!',
      });
    }
    res.status(200).json({ success: true, data: recommendation });
  } catch (error) { next(error); }
};

// GET /api/recommendations/analysis — uses QuizAttempt (main model used in this app)
const getMyAnalysis = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user._id })
      .populate('quiz', 'title')
      .populate('course', 'title')
      .sort({ createdAt: -1 });

    if (!attempts.length) {
      return res.status(200).json({
        success: true,
        data: { hasData: false, message: 'Complete quizzes to see your performance analysis' },
      });
    }

    // Build topic stats from weakTopics/strongTopics arrays
    const topicMap = {};
    attempts.forEach(a => {
      (a.weakTopics || []).forEach(t => {
        if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 };
        topicMap[t].total++;
      });
      (a.strongTopics || []).forEach(t => {
        if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 };
        topicMap[t].correct++;
        topicMap[t].total++;
      });
    });

    const topicStats = {};
    Object.entries(topicMap).forEach(([topic, s]) => {
      topicStats[topic] = {
        correct: s.correct, total: s.total,
        percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      };
    });

    const weakTopics    = [];
    const strongTopics  = [];
    const averageTopics = [];

    Object.entries(topicStats).forEach(([topic, stats]) => {
      const entry = { topic, ...stats };
      if (stats.percentage < 60)      weakTopics.push(entry);
      else if (stats.percentage >= 80) strongTopics.push(entry);
      else                             averageTopics.push(entry);
    });

    const scores = attempts.map(a => a.score || 0);
    const overallScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

    const recentHistory = attempts.slice(0, 10).map(a => ({
      quizTitle:   a.quiz?.title   || 'Quiz',
      courseTitle: a.course?.title || 'Course',
      score:       a.score,
      passed:      a.isPassed,
      date:        a.createdAt,
    }));

    const progressData  = await Progress.find({ student: req.user._id });
    const totalTimeSpent    = progressData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    const completedLessons  = progressData.filter(p => p.isCompleted).length;

    // Enrollment-based progress
    const enrollments = await Enrollment.find({ student: req.user._id }).populate('course', 'title');
    const courseProgress = enrollments.map(e => ({
      courseTitle:         e.course?.title || 'Course',
      completionPct:       e.completionPercentage || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        hasData: true,
        overallScore,
        weakTopics:    weakTopics.sort((a,b) => a.percentage - b.percentage),
        strongTopics:  strongTopics.sort((a,b) => b.percentage - a.percentage),
        averageTopics,
        recentHistory,
        courseProgress,
        stats: {
          totalQuizzesTaken:   attempts.length,
          quizzesPassed:       attempts.filter(a => a.isPassed).length,
          totalTimeSpentMinutes: totalTimeSpent,
          completedLessons,
          averageScore:        overallScore,
          total:               attempts.length,
          avgScore:            overallScore,
        },
      },
    });
  } catch (error) { next(error); }
};

// PUT /api/recommendations/:recId/item/:itemId/dismiss
const dismissRecommendation = async (req, res, next) => {
  try {
    const rec = await Recommendation.findOne({ _id: req.params.recId, student: req.user._id });
    if (!rec) return res.status(404).json({ success: false, message: 'Recommendation not found' });
    const item = rec.recommendations.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    item.isDismissed = true;
    await rec.save();
    res.status(200).json({ success: true, message: 'Recommendation dismissed' });
  } catch (error) { next(error); }
};

// GET /api/recommendations/admin/all
const getAllRecommendations = async (req, res, next) => {
  try {
    const recommendations = await Recommendation.find({ isActive: true })
      .populate('student', 'name email learningLevel')
      .sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, data: recommendations });
  } catch (error) { next(error); }
};

module.exports = { generateMyRecommendations, getMyRecommendations, getMyAnalysis, dismissRecommendation, getAllRecommendations };