// controllers/recommendationController.js
// Phase 11: ML-powered recommendations with rule-based fallback.
const Recommendation = require('../models/Recommendation');
const QuizAttempt    = require('../models/QuizAttempt');
const Progress       = require('../models/Progress');
const Enrollment     = require('../models/Enrollment');
const Lesson         = require('../models/Lesson');
const Quiz           = require('../models/Quiz');
const User           = require('../models/User');

const {
  generateRecommendations: generateRuleBased,
  getLatestRecommendation,
  aggregateTopicPerformance,
} = require('../ai/recommendationEngine');

const {
  getMLRecommendations,
  triggerMLTraining,
  isMLServiceUp,
  getTopicName,
  exportInteractionsCSV,
} = require('../services/mlBridgeService');

const { sendRecommendationEmail } = require('../services/emailService');

const RECOMMENDATION_EXPIRY_DAYS = 7;
const MAX_RECOMMENDATIONS        = 8;

// POST /api/recommendations/generate
const generateMyRecommendations = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    console.log(`🤖 Generating recommendations for student ${studentId}`);

    let mlResult = null;
    const mlUp   = await isMLServiceUp();

    if (mlUp) {
      console.log('🐍 ML service is up — attempting ML recommendations');
      mlResult = await getMLRecommendations(studentId.toString());

      if (!mlResult) {
        console.log('📊 Student not in ML matrix — exporting data and training…');
        const { rowCount } = await exportInteractionsCSV();
        if (rowCount >= 3) {
          const trainResult = await triggerMLTraining();
          if (trainResult.success) {
            mlResult = await getMLRecommendations(studentId.toString());
          } else {
            console.warn('[ML] Training failed:', trainResult.message);
          }
        }
      }
    } else {
      console.log('⚠️  ML service offline — using rule-based engine');
    }

    let recommendation;
    if (mlResult) {
      recommendation = await buildRecommendationFromML(studentId, mlResult);
    } else {
      const result = await generateRuleBased(studentId);
      if (!result.success) {
        return res.status(200).json({ success: false, message: result.message, needsMoreData: true });
      }
      recommendation = result.data;
    }

    const detectedLevel = recommendation.analysisSummary?.detectedLevel;
    if (detectedLevel) {
      await User.findByIdAndUpdate(studentId, { learningLevel: detectedLevel });
    }

    // ── Fire-and-forget recommendation email ────────────────
    sendRecommendationEmail(
      { name: req.user.name, email: req.user.email },
      recommendation
    );

    res.status(200).json({
      success: true,
      message: 'Personalized learning path generated!',
      data:    recommendation,
      engine:  mlResult ? 'ml-v1' : 'rule-based-v1',
    });
  } catch (error) { next(error); }
};

async function buildRecommendationFromML(studentId, mlData) {
  const {
    recommended_topics = [], weak_topics = [], cluster,
    explanation = {},
  } = mlData;

  // ML returns numeric IDs — look them up in topic_id_map.json
  const mlWeakTopicNames = weak_topics.map(id => getTopicName(id));
  const mlRecTopicNames  = recommended_topics.map(id => getTopicName(id));

  const enrollments       = await Enrollment.find({ student: studentId }).populate('course');
  const validEnrollments  = enrollments.filter(e => e.course != null);
  const courseIds         = validEnrollments.map(e => e.course._id);

  const progressRecords = await Progress.find({ student: studentId, isCompleted: true });
  const completedIds    = new Set(progressRecords.map(p => p.lesson.toString()));

  const attempts = await QuizAttempt.find({ student: studentId }).sort({ createdAt: -1 }).limit(50);
  const topicStats   = aggregateTopicPerformance(attempts);
  const overallScore = Object.values(topicStats).length
    ? Math.round(Object.values(topicStats).reduce((s, t) => s + t.percentage, 0) / Object.values(topicStats).length)
    : 0;

  const weakTopicsSummary   = [];
  const strongTopicsSummary = [];
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const entry = { topic, score: stats.percentage, quizzesTaken: stats.total };
    if (stats.percentage < 60) weakTopicsSummary.push(entry);
    else if (stats.percentage >= 80) strongTopicsSummary.push(entry);
  });

  // FIX: Merge ML topic names with real string weak topics from quiz attempts.
  // ML numeric IDs may not map cleanly to lesson topic strings if the topic_id_map
  // was built from pre-existing demo data. Real quiz weak topics (from aggregateTopicPerformance)
  // are always correct string names like 'arrays', 'variables' — use both sources.
  const realWeakTopics = weakTopicsSummary.map(t => t.topic);
  const weakTopicNames = [...new Set([...realWeakTopics, ...mlWeakTopicNames])].filter(
    t => t && !t.startsWith('Topic ')  // drop unresolved numeric fallbacks like "Topic 101"
  );
  // If ML names resolved to real strings, use them; otherwise fall back to real weak topics only
  const recTopicNames = mlRecTopicNames.filter(t => t && !t.startsWith('Topic '));

  // Combine: use all weak topics + ML-recommended topics for lesson matching
  const targetTopics = [...new Set([...weakTopicNames, ...recTopicNames])];

  const items = [];

  if (targetTopics.length > 0) {
    const lessons = await Lesson.find({
      course: { $in: courseIds }, topics: { $in: targetTopics }, isPublished: true,
    }).populate('course', 'title level').populate('module', 'title').limit(20);

    for (const lesson of lessons) {
      if (!lesson?._id || completedIds.has(lesson._id.toString())) continue;
      const coveredWeak = weakTopicNames.filter(t => lesson.topics?.includes(t));
      const coveredRec  = recTopicNames.filter(t => lesson.topics?.includes(t));
      if (!coveredWeak.length && !coveredRec.length) continue;

      const primaryTopic = coveredWeak[0] || coveredRec[0];
      const topicScore   = topicStats[primaryTopic]?.percentage ?? 50;
      const confidence   = Math.min(99, Math.round(100 - topicScore + coveredWeak.length * 5));

      const shapContribs    = explanation.shap_contributions || {};
      const topShapFeature  = Object.keys(shapContribs).sort((a, b) => Math.abs(shapContribs[b]) - Math.abs(shapContribs[a]))[0];

      // Build rich XAI explanation using real topic score + SHAP insight
      let xaiExplanation;
      if (explanation.human_readable && !explanation.human_readable.toLowerCase().includes('cluster 0')) {
        xaiExplanation = explanation.human_readable;
      } else {
        xaiExplanation = topicScore < 60
          ? `You scored ${topicScore}% on "${primaryTopic}" — the ML model (KMeans cluster ${cluster}) identified this as your top improvement area.`
          : `"${primaryTopic}" is your next recommended step according to ML cluster ${cluster}.`;
      }
      if (topShapFeature && shapContribs[topShapFeature] < 0) {
        xaiExplanation += ` SHAP analysis confirms "${topShapFeature}" is the key factor pulling your performance down.`;
      } else if (topShapFeature && shapContribs[topShapFeature] > 0) {
        xaiExplanation += ` SHAP shows "${topShapFeature}" as a relative strength — reinforce it here.`;
      }

      const reasonFactors = [];
      if (topicScore < 60)       reasonFactors.push({ factor: 'ml_weak_topic',    value: topicScore,                   description: `ML flagged "${primaryTopic}" as weak (your score: ${topicScore}%)` });
      if (topShapFeature)        reasonFactors.push({ factor: 'shap_top_feature', value: shapContribs[topShapFeature],  description: `SHAP: "${topShapFeature}" had the strongest impact on this recommendation` });
      if (cluster !== undefined) reasonFactors.push({ factor: 'ml_cluster',       value: cluster,                      description: `KMeans grouped you in cluster ${cluster} — peers here improved fastest on "${primaryTopic}"` });

      items.push({ type: 'lesson', itemId: lesson._id, itemModel: 'Lesson', explanation: xaiExplanation, addressesTopic: primaryTopic, confidence, priority: Math.round((100 - topicScore) / 10), reasonFactors });
      if (items.length >= MAX_RECOMMENDATIONS) break;
    }
  }

  if (weakTopicNames.length > 0 && items.length < MAX_RECOMMENDATIONS) {
    const quizzes = await Quiz.find({ course: { $in: courseIds }, topicsTested: { $in: weakTopicNames }, isPublished: true }).populate('course', 'title').limit(5);
    for (const quiz of quizzes) {
      if (!quiz?._id) continue;
      const primaryTopic = weakTopicNames.find(t => quiz.topicsTested?.includes(t));
      const topicScore   = topicStats[primaryTopic]?.percentage ?? 50;
      const recentPass   = attempts.find(a => a.quiz?.toString() === quiz._id.toString() && (a.score || 0) >= 70);
      if (recentPass) continue;
      items.push({ type: 'quiz', itemId: quiz._id, itemModel: 'Quiz', explanation: `Practice quiz recommended by ML: your score in "${primaryTopic}" is ${topicScore}%. Retaking will reinforce understanding.`, addressesTopic: primaryTopic || 'general', confidence: 75, priority: 5, reasonFactors: [{ factor: 'ml_practice_needed', value: topicScore, description: `ML model identified "${primaryTopic}" as needing more practice` }] });
    }
  }

  if (items.length === 0) {
    const nextLesson = await Lesson.findOne({ course: { $in: courseIds }, _id: { $nin: [...completedIds] }, isPublished: true }).populate('course', 'title').sort({ order: 1 });
    if (nextLesson?._id) {
      items.push({ type: 'lesson', itemId: nextLesson._id, itemModel: 'Lesson', explanation: `Continue your learning journey! ML cluster analysis (cluster ${cluster}) suggests this as your next step.`, addressesTopic: nextLesson.topics?.[0] || 'general', confidence: 80, priority: 5, reasonFactors: [{ factor: 'ml_cluster_next', value: cluster, description: `ML assigned you to cluster ${cluster} — this lesson matches your learning group's path` }] });
    }
  }

  items.sort((a, b) => b.priority - a.priority);

  const detectedLevel = overallScore >= 80 && weakTopicsSummary.length === 0 ? 'advanced'
    : overallScore >= 60 && weakTopicsSummary.length <= 2 ? 'intermediate' : 'beginner';

  await Recommendation.updateMany({ student: studentId, isActive: true }, { $set: { isActive: false } });

  return Recommendation.create({
    student:         studentId,
    recommendations: items.slice(0, MAX_RECOMMENDATIONS),
    analysisSummary: {
      overallScore, weakTopics: weakTopicsSummary, strongTopics: strongTopicsSummary,
      detectedLevel, coursesAnalyzed: courseIds, totalQuizzesAnalyzed: attempts.length,
      mlCluster: cluster,
      // FIX: Store resolved real string names alongside numeric IDs so frontend panels
      // can display "arrays (40%)" instead of "Topic 101"
      mlWeakTopics: weakTopicNames.map(name => ({ name, score: topicStats[name]?.percentage ?? null })),
      mlRecommendedTopics: [...new Set([...recTopicNames, ...weakTopicNames])].map(name => ({ name })),
      shapExplanation: explanation,
    },
    generatedBy: 'ml-v1',
    validUntil:  new Date(Date.now() + RECOMMENDATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    isActive:    true,
  });
}

const getMyRecommendations = async (req, res, next) => {
  try {
    const recommendation = await getLatestRecommendation(req.user._id);
    if (!recommendation) {
      return res.status(200).json({ success: true, data: null, message: 'No recommendations yet. Complete some quizzes to get personalized suggestions!' });
    }
    res.status(200).json({ success: true, data: recommendation });
  } catch (error) { next(error); }
};

const getMyAnalysis = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user._id }).populate('quiz', 'title').populate('course', 'title').sort({ createdAt: -1 });
    if (!attempts.length) {
      return res.status(200).json({ success: true, data: { hasData: false, message: 'Complete quizzes to see your performance analysis' } });
    }
    const topicStats  = aggregateTopicPerformance(attempts);
    const weakTopics  = [], strongTopics = [], averageTopics = [];
    Object.entries(topicStats).forEach(([topic, stats]) => {
      const entry = { topic, ...stats };
      if (stats.percentage < 60) weakTopics.push(entry);
      else if (stats.percentage >= 80) strongTopics.push(entry);
      else averageTopics.push(entry);
    });
    const scores = attempts.map(a => a.score || 0);
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const recentHistory = attempts.slice(0, 10).map(a => ({ quizTitle: a.quiz?.title || 'Quiz', courseTitle: a.course?.title || 'Course', score: a.score, passed: a.isPassed, date: a.createdAt }));
    const progressData     = await Progress.find({ student: req.user._id });
    const totalTimeSpent   = progressData.reduce((s, p) => s + (p.timeSpent || 0), 0);
    const completedLessons = progressData.filter(p => p.isCompleted).length;
    const enrollments      = await Enrollment.find({ student: req.user._id }).populate('course', 'title');
    const courseProgress   = enrollments.map(e => ({ courseTitle: e.course?.title || 'Course', completionPct: e.completionPercentage || 0 }));
    const latestRec = await Recommendation.findOne({ student: req.user._id, isActive: true }).sort({ createdAt: -1 });
    const mlInsights = latestRec?.analysisSummary?.shapExplanation ? { cluster: latestRec.analysisSummary.mlCluster, shapContributions: latestRec.analysisSummary.shapExplanation?.shap_contributions, humanReadable: latestRec.analysisSummary.shapExplanation?.human_readable, engine: latestRec.generatedBy } : null;
    res.status(200).json({ success: true, data: { hasData: true, overallScore, weakTopics: weakTopics.sort((a,b)=>a.percentage-b.percentage), strongTopics: strongTopics.sort((a,b)=>b.percentage-a.percentage), averageTopics, recentHistory, courseProgress, mlInsights, stats: { totalQuizzesTaken: attempts.length, quizzesPassed: attempts.filter(a=>a.isPassed).length, totalTimeSpentMinutes: totalTimeSpent, completedLessons, averageScore: overallScore, total: attempts.length, avgScore: overallScore } } });
  } catch (error) { next(error); }
};

const triggerTraining = async (req, res, next) => {
  try {
    const result = await triggerMLTraining();
    res.status(result.success ? 200 : 503).json(result);
  } catch (error) { next(error); }
};

const getMLStatus = async (req, res, next) => {
  try {
    const up = await isMLServiceUp();
    res.status(200).json({ mlServiceOnline: up, mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5001' });
  } catch (error) { next(error); }
};

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

const getAllRecommendations = async (req, res, next) => {
  try {
    const recommendations = await Recommendation.find({ isActive: true }).populate('student', 'name email learningLevel').sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, data: recommendations });
  } catch (error) { next(error); }
};

// ── Internal helper: called by quizController after every quiz attempt ──────────
// Runs the full ML or rule-based pipeline without needing req/res objects.
const generateRecommendationsForStudent = async (studentId) => {
  const mlUp   = await isMLServiceUp();
  let mlResult = null;

  if (mlUp) {
    mlResult = await getMLRecommendations(studentId.toString());
    if (!mlResult) {
      const { rowCount } = await exportInteractionsCSV();
      if (rowCount >= 3) {
        const trainResult = await triggerMLTraining();
        if (trainResult.success) {
          mlResult = await getMLRecommendations(studentId.toString());
        }
      }
    }
  }

  let recommendation;
  if (mlResult) {
    recommendation = await buildRecommendationFromML(studentId, mlResult);
  } else {
    const result = await generateRuleBased(studentId);
    if (!result.success) return null;
    recommendation = result.data;
  }

  const detectedLevel = recommendation?.analysisSummary?.detectedLevel;
  if (detectedLevel) {
    await User.findByIdAndUpdate(studentId, { learningLevel: detectedLevel });
  }

  console.log(`✅ [Auto-Regen] Recommendations updated for student ${studentId}`);
  return recommendation;
};

module.exports = { generateMyRecommendations, getMyRecommendations, getMyAnalysis, dismissRecommendation, getAllRecommendations, triggerTraining, getMLStatus, generateRecommendationsForStudent };