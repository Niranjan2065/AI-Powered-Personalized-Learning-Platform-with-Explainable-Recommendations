// controllers/recommendationController.js
// Phase 12: Forgetting Curve integration — "due for review" items injected
// at the top of every recommendation set, ranked most-overdue first.
const Recommendation = require('../models/Recommendation');
const QuizAttempt    = require('../models/QuizAttempt');
const Progress       = require('../models/Progress');
const Enrollment     = require('../models/Enrollment');
const Lesson         = require('../models/Lesson');
const Quiz           = require('../models/Quiz');
const User           = require('../models/User');

const {
  generateRecommendations: generateRuleBased,
  aggregateTopicPerformance,
  resolveScore,
} = require('../ai/recommendationEngine');

const {
  getTopicsNeedingReview,   // ← Step 2: pulls overdue SR lessons
  countDueReviews,          // ← Step 2: dashboard count
} = require('../ai/forgettingCurve');

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
// Max slots reserved at the top of the list for "due for review" lessons.
// Keeping this at 2 ensures new content still dominates the feed.
const MAX_REVIEW_SLOTS           = 2;

// ---------------------------------------------------------------------------
// getLatestRecommendation — local DB lookup (not from recommendationEngine)
// ---------------------------------------------------------------------------
async function getLatestRecommendation(studentId) {
  return Recommendation.findOne({ student: studentId, isActive: true })
    .sort({ createdAt: -1 })
    .populate({
      path:   'recommendations.itemId',
      select: 'title description duration order topics',
    });
}

// ---------------------------------------------------------------------------
// pct() — safe stat field reader
// aggregateTopicPerformance stores score as `stats.performance`, not
// `stats.percentage`. This helper accepts either so refactors stay contained.
// ---------------------------------------------------------------------------
function pct(stats) {
  return stats?.performance ?? stats?.percentage ?? 0;
}

// ---------------------------------------------------------------------------
// buildReviewItems
// Converts getTopicsNeedingReview() results into RecommendationItem shape
// so they slot directly into the recommendations array without any schema
// changes — they reuse the existing `lesson` type with a `review_due` factor.
// ---------------------------------------------------------------------------
async function buildReviewItems(studentId, courseIds, limit = MAX_REVIEW_SLOTS) {
  const dueTopics = await getTopicsNeedingReview(studentId, limit);
  const items     = [];

  for (const due of dueTopics) {
    if (!due.lessonId) continue;

    // Only surface review items from enrolled courses
    const lessonDoc = await Lesson.findById(due.lessonId)
      .select('_id title topics course module')
      .lean();

    if (!lessonDoc) continue;
    const inEnrolledCourse = courseIds.some(
      id => id.toString() === lessonDoc.course?.toString()
    );
    if (!inEnrolledCourse) continue;

    // How overdue is it? Turns into the confidence score (more overdue = more urgent)
    const urgencyPct = Math.min(99, 60 + due.daysSinceReview * 5);

    const lastScoreLabel = due.lastScore != null
      ? `You scored ${due.lastScore}% last time.`
      : '';

    items.push({
      type:           'lesson',
      itemId:         due.lessonId,
      itemModel:      'Lesson',
      isReviewDue:    true,                       // Step 2 flag — frontend uses this for the badge
      explanation:    `📅 Review due — it has been ${due.daysSinceReview} day${due.daysSinceReview !== 1 ? 's' : ''} since you last studied "${due.lessonTitle}". ${lastScoreLabel} Spaced repetition keeps this topic fresh.`,
      addressesTopic: due.topics?.[0] || 'review',
      confidence:     urgencyPct,
      priority:       10,                         // always highest priority — float to top
      reasonFactors:  [
        {
          factor:      'review_due',
          value:       due.daysSinceReview,
          description: `Forgetting curve: "${due.lessonTitle}" is ${due.daysSinceReview} day${due.daysSinceReview !== 1 ? 's' : ''} overdue for review (reviewed ${due.reviewCount} time${due.reviewCount !== 1 ? 's' : ''} total)`,
        },
        ...(due.lastScore != null ? [{
          factor:      'last_score',
          value:       due.lastScore,
          description: `Last quiz score on this topic: ${due.lastScore}%`,
        }] : []),
      ],
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// POST /api/recommendations/generate
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// buildRecommendationFromML — core builder (ML path)
// Step 2 change: review items are prepended before ML items, then the whole
// list is trimmed to MAX_RECOMMENDATIONS. Priority sort ensures review items
// (priority 10) always beat ML items (priority 1-9).
// ---------------------------------------------------------------------------
async function buildRecommendationFromML(studentId, mlData) {
  const {
    recommended_topics = [], weak_topics = [], cluster,
    explanation = {},
  } = mlData;

  const mlWeakTopicNames = weak_topics.map(id => getTopicName(id));
  const mlRecTopicNames  = recommended_topics.map(id => getTopicName(id));

  const enrollments      = await Enrollment.find({ student: studentId }).populate('course');
  const validEnrollments = enrollments.filter(e => e.course != null);
  const courseIds        = validEnrollments.map(e => e.course._id);

  const progressRecords = await Progress.find({ student: studentId, isCompleted: true });
  const completedIds    = new Set(progressRecords.map(p => p.lesson.toString()));

  const attempts   = await QuizAttempt.find({ student: studentId }).sort({ createdAt: -1 }).limit(50);
  const topicStats = aggregateTopicPerformance(attempts);

  const topicValues  = Object.values(topicStats);
  const overallScore = topicValues.length
    ? Math.round(topicValues.reduce((s, t) => s + pct(t), 0) / topicValues.length)
    : (() => {
        const scored = attempts.map(a => resolveScore(a)).filter(s => s !== null);
        return scored.length
          ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
          : 0;
      })();

  const weakTopicsSummary   = [];
  const strongTopicsSummary = [];
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const score = pct(stats);
    const entry = { topic, score, quizzesTaken: stats.total };
    if (score < 60)       weakTopicsSummary.push(entry);
    else if (score >= 80) strongTopicsSummary.push(entry);
  });

  const realWeakTopics = weakTopicsSummary.map(t => t.topic);
  const weakTopicNames = [...new Set([...realWeakTopics, ...mlWeakTopicNames])].filter(
    t => t && !t.startsWith('Topic ')
  );
  const recTopicNames = mlRecTopicNames.filter(t => t && !t.startsWith('Topic '));
  const targetTopics  = [...new Set([...weakTopicNames, ...recTopicNames])];

  // ── Step 2: collect review-due items first ────────────────────────────────
  const reviewItems = await buildReviewItems(studentId, courseIds, MAX_REVIEW_SLOTS);
  // Track lesson IDs already in review slots so ML items don't duplicate them
  const reviewLessonIds = new Set(reviewItems.map(r => r.itemId.toString()));

  // ── ML lesson items ───────────────────────────────────────────────────────
  const mlItems = [];

  if (targetTopics.length > 0) {
    const lessons = await Lesson.find({
      course: { $in: courseIds }, topics: { $in: targetTopics }, isPublished: true,
    }).populate('course', 'title level').populate('module', 'title').limit(20);

    for (const lesson of lessons) {
      if (!lesson?._id) continue;
      if (completedIds.has(lesson._id.toString()))    continue;
      if (reviewLessonIds.has(lesson._id.toString())) continue; // already in review slot

      const coveredWeak = weakTopicNames.filter(t => lesson.topics?.includes(t));
      const coveredRec  = recTopicNames.filter(t => lesson.topics?.includes(t));
      if (!coveredWeak.length && !coveredRec.length) continue;

      const primaryTopic = coveredWeak[0] || coveredRec[0];
      const topicScore   = pct(topicStats[primaryTopic]) ?? 50;
      const confidence   = Math.min(99, Math.round(100 - topicScore + coveredWeak.length * 5));

      const shapContribs   = explanation.shap_contributions || {};
      const topShapFeature = Object.keys(shapContribs).sort(
        (a, b) => Math.abs(shapContribs[b]) - Math.abs(shapContribs[a])
      )[0];

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
      if (topShapFeature)        reasonFactors.push({ factor: 'shap_top_feature', value: shapContribs[topShapFeature], description: `SHAP: "${topShapFeature}" had the strongest impact on this recommendation` });
      if (cluster !== undefined) reasonFactors.push({ factor: 'ml_cluster',       value: cluster,                      description: `KMeans grouped you in cluster ${cluster} — peers here improved fastest on "${primaryTopic}"` });

      mlItems.push({
        type: 'lesson', itemId: lesson._id, itemModel: 'Lesson',
        isReviewDue:    false,
        explanation:    xaiExplanation,
        addressesTopic: primaryTopic,
        confidence,
        priority:       Math.round((100 - topicScore) / 10),
        reasonFactors,
      });
      if (mlItems.length >= MAX_RECOMMENDATIONS) break;
    }
  }

  if (weakTopicNames.length > 0 && mlItems.length < MAX_RECOMMENDATIONS) {
    const quizzes = await Quiz.find({
      course: { $in: courseIds }, topicsTested: { $in: weakTopicNames }, isPublished: true,
    }).populate('course', 'title').limit(5);

    for (const quiz of quizzes) {
      if (!quiz?._id) continue;
      const primaryTopic = weakTopicNames.find(t => quiz.topicsTested?.includes(t));
      const topicScore   = pct(topicStats[primaryTopic]) ?? 50;
      const recentPass   = attempts.find(
        a => a.quiz?.toString() === quiz._id.toString() && (resolveScore(a) ?? 0) >= 70
      );
      if (recentPass) continue;
      mlItems.push({
        type: 'quiz', itemId: quiz._id, itemModel: 'Quiz',
        isReviewDue:    false,
        explanation:    `Practice quiz recommended by ML: your score in "${primaryTopic}" is ${topicScore}%. Retaking will reinforce understanding.`,
        addressesTopic: primaryTopic || 'general',
        confidence:     75,
        priority:       5,
        reasonFactors:  [{ factor: 'ml_practice_needed', value: topicScore, description: `ML model identified "${primaryTopic}" as needing more practice` }],
      });
    }
  }

  if (mlItems.length === 0 && reviewItems.length === 0) {
    const nextLesson = await Lesson.findOne({
      course: { $in: courseIds }, _id: { $nin: [...completedIds] }, isPublished: true,
    }).populate('course', 'title').sort({ order: 1 });

    if (nextLesson?._id) {
      mlItems.push({
        type: 'lesson', itemId: nextLesson._id, itemModel: 'Lesson',
        isReviewDue:    false,
        explanation:    `Continue your learning journey! ML cluster analysis (cluster ${cluster}) suggests this as your next step.`,
        addressesTopic: nextLesson.topics?.[0] || 'general',
        confidence:     80,
        priority:       5,
        reasonFactors:  [{ factor: 'ml_cluster_next', value: cluster, description: `ML assigned you to cluster ${cluster} — this lesson matches your learning group's path` }],
      });
    }
  }

  // ── Merge: review items (priority 10) always sort above ML items ──────────
  const allItems = [...reviewItems, ...mlItems]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_RECOMMENDATIONS);

  const detectedLevel =
    overallScore >= 80 && weakTopicsSummary.length === 0 ? 'advanced'
    : overallScore >= 60 && weakTopicsSummary.length <= 2 ? 'intermediate'
    : 'beginner';

  await Recommendation.updateMany({ student: studentId, isActive: true }, { $set: { isActive: false } });

  const safeOverallScore = Number.isFinite(overallScore) ? overallScore : 0;

  return Recommendation.create({
    student:         studentId,
    recommendations: allItems,
    analysisSummary: {
      overallScore:          safeOverallScore,
      weakTopics:            weakTopicsSummary,
      strongTopics:          strongTopicsSummary,
      detectedLevel,
      coursesAnalyzed:       courseIds,
      totalQuizzesAnalyzed:  attempts.length,
      mlCluster:             cluster,
      mlWeakTopics:          weakTopicNames.map(name => ({ name, score: pct(topicStats[name]) ?? null })),
      mlRecommendedTopics:   [...new Set([...recTopicNames, ...weakTopicNames])].map(name => ({ name })),
      shapExplanation:       explanation,
      // Step 2: store SR summary so frontend can show "X lessons due for review"
      reviewDueCount:        reviewItems.length,
    },
    generatedBy: 'ml-v1',
    validUntil:  new Date(Date.now() + RECOMMENDATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    isActive:    true,
  });
}

// ---------------------------------------------------------------------------
// GET /api/recommendations/my
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GET /api/recommendations/review-due   ← NEW in Step 2
// Returns the live list of lessons overdue for spaced-repetition review.
// Frontend uses this for the "Due for Review" dashboard card and badge count.
// Does NOT require a stored Recommendation document — reads Progress directly.
// ---------------------------------------------------------------------------
const getReviewDue = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const limit     = Math.min(Number(req.query.limit) || 10, 20);

    const enrollments  = await Enrollment.find({ student: studentId }).populate('course');
    const courseIds    = enrollments.filter(e => e.course != null).map(e => e.course._id);

    const dueTopics    = await getTopicsNeedingReview(studentId, limit);
    const dueCount     = await countDueReviews(studentId);

    // Filter to enrolled courses only (same guard as buildReviewItems)
    const courseIdSet  = new Set(courseIds.map(id => id.toString()));
    const filtered     = [];

    for (const due of dueTopics) {
      if (!due.lessonId) continue;
      const lesson = await Lesson.findById(due.lessonId).select('course').lean();
      if (lesson && courseIdSet.has(lesson.course?.toString())) {
        filtered.push(due);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalDue:    dueCount,
        items:       filtered,
        // Human-readable headline for the dashboard card
        headline:    dueCount === 0
          ? 'All caught up! No reviews due.'
          : `${dueCount} lesson${dueCount !== 1 ? 's' : ''} due for review`,
      },
    });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// GET /api/recommendations/analysis
// ---------------------------------------------------------------------------
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

    const topicStats  = aggregateTopicPerformance(attempts);
    const weakTopics  = [], strongTopics = [], averageTopics = [];

    Object.entries(topicStats).forEach(([topic, stats]) => {
      const score = pct(stats);
      const entry = { topic, ...stats, percentage: score };
      if (score < 60)       weakTopics.push(entry);
      else if (score >= 80) strongTopics.push(entry);
      else                  averageTopics.push(entry);
    });

    const scored       = attempts.map(a => resolveScore(a)).filter(s => s !== null);
    const overallScore = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : 0;

    const recentHistory = attempts.slice(0, 10).map(a => ({
      quizTitle:   a.quiz?.title   || 'Quiz',
      courseTitle: a.course?.title || 'Course',
      score:       resolveScore(a) ?? 0,
      passed:      a.isPassed,
      date:        a.createdAt,
    }));

    const progressData     = await Progress.find({ student: req.user._id });
    const totalTimeSpent   = progressData.reduce((s, p) => s + (p.timeSpent || 0), 0);
    const completedLessons = progressData.filter(p => p.isCompleted).length;

    // Step 2: include SR review count in analysis response
    const dueReviewCount = await countDueReviews(req.user._id);

    const enrollments    = await Enrollment.find({ student: req.user._id }).populate('course', 'title');
    const courseProgress = enrollments.map(e => ({
      courseTitle:   e.course?.title || 'Course',
      completionPct: e.completionPercentage || 0,
    }));

    const latestRec  = await Recommendation.findOne({ student: req.user._id, isActive: true }).sort({ createdAt: -1 });
    const mlInsights = latestRec?.analysisSummary?.shapExplanation
      ? {
          cluster:           latestRec.analysisSummary.mlCluster,
          shapContributions: latestRec.analysisSummary.shapExplanation?.shap_contributions,
          humanReadable:     latestRec.analysisSummary.shapExplanation?.human_readable,
          engine:            latestRec.generatedBy,
        }
      : null;

    res.status(200).json({
      success: true,
      data: {
        hasData: true,
        overallScore,
        weakTopics:    weakTopics.sort((a, b) => pct(a) - pct(b)),
        strongTopics:  strongTopics.sort((a, b) => pct(b) - pct(a)),
        averageTopics,
        recentHistory,
        courseProgress,
        mlInsights,
        stats: {
          totalQuizzesTaken:     attempts.length,
          quizzesPassed:         attempts.filter(a => a.isPassed).length,
          totalTimeSpentMinutes: totalTimeSpent,
          completedLessons,
          averageScore:          overallScore,
          total:                 attempts.length,
          avgScore:              overallScore,
          dueReviewCount,          // Step 2: feeds the dashboard "Due for Review" card
        },
      },
    });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Remaining handlers — unchanged
// ---------------------------------------------------------------------------
const triggerTraining = async (req, res, next) => {
  try {
    const result = await triggerMLTraining();
    res.status(result.success ? 200 : 503).json(result);
  } catch (error) { next(error); }
};

const getMLStatus = async (req, res, next) => {
  try {
    const up = await isMLServiceUp();
    res.status(200).json({
      mlServiceOnline: up,
      mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5001',
    });
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
    const recommendations = await Recommendation.find({ isActive: true })
      .populate('student', 'name email learningLevel')
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: recommendations });
  } catch (error) { next(error); }
};

// Internal helper — called by quizController after every attempt
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

module.exports = {
  generateMyRecommendations,
  getMyRecommendations,
  getReviewDue,                   // ← new export
  getMyAnalysis,
  dismissRecommendation,
  getAllRecommendations,
  triggerTraining,
  getMLStatus,
  generateRecommendationsForStudent,
};