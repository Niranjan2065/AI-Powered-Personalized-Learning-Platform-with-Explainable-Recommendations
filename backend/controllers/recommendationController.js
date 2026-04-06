// ============================================================
// controllers/recommendationController.js
// ============================================================

const Recommendation = require('../models/Recommendation');
const Result = require('../models/Result');
const Progress = require('../models/Progress');
const { generateRecommendations, getLatestRecommendation, aggregateTopicPerformance } = require('../ai/recommendationEngine');
const User = require('../models/User');

// @desc  Generate AI recommendations for current student
// @route POST /api/recommendations/generate
// @access Private (Student)
const generateMyRecommendations = async (req, res, next) => {
  try {
    const result = await generateRecommendations(req.user._id);

    if (!result.success) {
      return res.status(200).json({
        success: false,
        message: result.message,
        needsMoreData: true,
      });
    }

    // Also update student's detected level
    const detectedLevel = result.data.analysisSummary?.detectedLevel;
    if (detectedLevel) {
      await User.findByIdAndUpdate(req.user._id, { learningLevel: detectedLevel });
    }

    res.status(200).json({
      success: true,
      message: 'Personalized learning path generated!',
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get current student's latest recommendations
// @route GET /api/recommendations/my
// @access Private (Student)
const getMyRecommendations = async (req, res, next) => {
  try {
    const recommendation = await getLatestRecommendation(req.user._id);

    if (!recommendation) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No recommendations yet. Complete some quizzes to get personalized suggestions!',
      });
    }

    res.status(200).json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
};

// @desc  Get full performance analysis (for student dashboard)
// @route GET /api/recommendations/analysis
// @access Private (Student)
const getMyAnalysis = async (req, res, next) => {
  try {
    const results = await Result.find({ student: req.user._id })
      .populate('quiz', 'title')
      .populate('course', 'title')
      .sort({ createdAt: -1 });

    if (!results.length) {
      return res.status(200).json({
        success: true,
        data: {
          hasData: false,
          message: 'Complete quizzes to see your performance analysis',
        },
      });
    }

    const topicStats = aggregateTopicPerformance(results);

    const weakTopics = [];
    const strongTopics = [];
    const averageTopics = [];

    Object.entries(topicStats).forEach(([topic, stats]) => {
      const entry = { topic, ...stats };
      if (stats.percentage < 60) weakTopics.push(entry);
      else if (stats.percentage >= 80) strongTopics.push(entry);
      else averageTopics.push(entry);
    });

    const overallScore = Object.values(topicStats).length
      ? Math.round(
          Object.values(topicStats).reduce((sum, s) => sum + s.percentage, 0) /
            Object.values(topicStats).length
        )
      : 0;

    // Recent quiz history (last 10)
    const recentHistory = results.slice(0, 10).map((r) => ({
      quizTitle: r.quiz?.title || 'Quiz',
      courseTitle: r.course?.title || 'Course',
      score: r.scorePercentage,
      passed: r.isPassed,
      date: r.createdAt,
    }));

    // Progress data for charts
    const progressData = await Progress.find({ student: req.user._id })
      .populate('course', 'title')
      .populate('lesson', 'title estimatedDuration');

    const totalTimeSpent = progressData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    const completedLessons = progressData.filter((p) => p.isCompleted).length;

    res.status(200).json({
      success: true,
      data: {
        hasData: true,
        overallScore,
        weakTopics: weakTopics.sort((a, b) => a.percentage - b.percentage),
        strongTopics: strongTopics.sort((a, b) => b.percentage - a.percentage),
        averageTopics,
        recentHistory,
        stats: {
          totalQuizzesTaken: results.length,
          quizzesPassed: results.filter((r) => r.isPassed).length,
          totalTimeSpentMinutes: totalTimeSpent,
          completedLessons,
          averageScore: overallScore,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Dismiss a recommendation item
// @route PUT /api/recommendations/:recId/item/:itemId/dismiss
// @access Private (Student)
const dismissRecommendation = async (req, res, next) => {
  try {
    const rec = await Recommendation.findOne({
      _id: req.params.recId,
      student: req.user._id,
    });

    if (!rec) return res.status(404).json({ success: false, message: 'Recommendation not found' });

    const item = rec.recommendations.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.isDismissed = true;
    await rec.save();

    res.status(200).json({ success: true, message: 'Recommendation dismissed' });
  } catch (error) {
    next(error);
  }
};

// @desc  Admin view all student recommendations
// @route GET /api/recommendations/admin/all
// @access Private (Admin)
const getAllRecommendations = async (req, res, next) => {
  try {
    const recommendations = await Recommendation.find({ isActive: true })
      .populate('student', 'name email learningLevel')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
};

module.exports = { generateMyRecommendations, getMyRecommendations, getMyAnalysis, dismissRecommendation, getAllRecommendations };
