// ============================================================
// ai/recommendationEngine.js - AI Recommendation Engine
// ============================================================
const Result       = require('../models/Result');
const Enrollment   = require('../models/Enrollment');
const Lesson       = require('../models/Lesson');
const Quiz         = require('../models/Quiz');
const Course       = require('../models/Course');
const Progress     = require('../models/Progress');
const Recommendation = require('../models/Recommendation');
const QuizAttempt  = require('../models/QuizAttempt'); // FIX: use QuizAttempt if no Result model

const WEAK_TOPIC_THRESHOLD    = 60;
const STRONG_TOPIC_THRESHOLD  = 80;
const MAX_RECOMMENDATIONS     = 8;
const MIN_QUIZ_DATA_POINTS    = 1;
const RECOMMENDATION_EXPIRY_DAYS = 7;

// ============================================================
// MAIN FUNCTION
// ============================================================
const generateRecommendations = async (studentId) => {
  console.log(`🤖 AI Engine: Generating recommendations for student ${studentId}`);

  // Step 1: Get all enrollments — FIX: filter out null courses
  const enrollments = await Enrollment.find({ student: studentId }).populate('course');
  const validEnrollments = enrollments.filter(e => e.course != null);

  if (!validEnrollments.length) {
    return { success: false, message: 'No enrollments found. Please enroll in a course first.' };
  }

  const courseIds = validEnrollments.map(e => e.course._id);

  // Step 2: Get quiz attempts (works with QuizAttempt model used in this app)
  let results = [];
  try {
    results = await QuizAttempt.find({
      student: studentId,
      course:  { $in: courseIds },
    }).sort({ createdAt: -1 });
  } catch {
    // fallback to Result model if it exists
    try {
      const Result = require('../models/Result');
      results = await Result.find({
        student: studentId,
        course:  { $in: courseIds },
      }).sort({ createdAt: -1 });
    } catch { results = []; }
  }

  if (results.length < MIN_QUIZ_DATA_POINTS) {
    return {
      success: false,
      message: 'Not enough quiz data. Please complete at least one quiz first.',
    };
  }

  // Step 3: Aggregate topic performance from weakTopics/strongTopics arrays
  const topicStats = aggregateTopicPerformance(results);
  console.log(`📊 AI: Analyzed ${results.length} quiz results, found ${Object.keys(topicStats).length} topics`);

  // Step 4: Identify weak and strong topics
  const weakTopics   = [];
  const strongTopics = [];

  Object.entries(topicStats).forEach(([topic, stats]) => {
    const pct = stats.percentage;
    if (pct < WEAK_TOPIC_THRESHOLD) {
      weakTopics.push({ topic, score: pct, quizzesTaken: stats.total });
    } else if (pct >= STRONG_TOPIC_THRESHOLD) {
      strongTopics.push({ topic, score: pct, quizzesTaken: stats.total });
    }
  });

  weakTopics.sort((a, b) => a.score - b.score);
  console.log(`🔴 Weak topics: ${weakTopics.map(t => t.topic).join(', ') || 'none'}`);
  console.log(`🟢 Strong topics: ${strongTopics.map(t => t.topic).join(', ') || 'none'}`);

  // Step 5: Overall score
  const allScores  = Object.values(topicStats).map(s => s.percentage);
  const overallScore = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // Step 6: Student level
  const detectedLevel = detectStudentLevel(overallScore, weakTopics.length, strongTopics.length);

  // Step 7: Completed lessons
  const completedLessonIds = new Set();
  try {
    const progressRecords = await Progress.find({ student: studentId, isCompleted: true });
    progressRecords.forEach(p => completedLessonIds.add(p.lesson.toString()));
  } catch { /* Progress model optional */ }

  // Step 8: Build recommendations
  const recommendationItems = await buildRecommendationItems({
    studentId, weakTopics, strongTopics, overallScore,
    detectedLevel, courseIds, completedLessonIds, results,
  });

  // Step 9: Deactivate old recommendations
  await Recommendation.updateMany(
    { student: studentId, isActive: true },
    { $set: { isActive: false } }
  );

  // Step 10: Save
  const recommendation = await Recommendation.create({
    student: studentId,
    recommendations: recommendationItems,
    analysisSummary: {
      overallScore,
      weakTopics,
      strongTopics,
      detectedLevel,
      coursesAnalyzed:      courseIds,
      totalQuizzesAnalyzed: results.length,
    },
    generatedBy: 'rule-based-v1',
    validUntil:  new Date(Date.now() + RECOMMENDATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    isActive: true,
  });

  console.log(`✅ AI: Generated ${recommendationItems.length} recommendations`);
  return { success: true, data: recommendation };
};

// ============================================================
// HELPER: Aggregate Topic Performance
// FIX: QuizAttempt stores weakTopics/strongTopics as string arrays,
//      not topicPerformance maps — handle both formats
// ============================================================
const aggregateTopicPerformance = (results) => {
  const topicStats = {};

  results.forEach(result => {

    // FORMAT A: topicPerformance map (old Result model)
    if (result.topicPerformance) {
      const perf = result.topicPerformance instanceof Map
        ? Object.fromEntries(result.topicPerformance)
        : result.topicPerformance;

      Object.entries(perf).forEach(([topic, stats]) => {
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0, percentage: 0 };
        topicStats[topic].correct += stats.correct || 0;
        topicStats[topic].total  += stats.total   || 0;
      });
    }

    // FORMAT B: QuizAttempt — weakTopics & strongTopics string arrays + score
    if (Array.isArray(result.weakTopics) || Array.isArray(result.strongTopics)) {
      const score = result.score || 0;

      (result.weakTopics || []).forEach(topic => {
        if (!topic) return;
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0, percentage: 0 };
        topicStats[topic].total   += 1;
        topicStats[topic].correct += 0; // wrong
      });

      (result.strongTopics || []).forEach(topic => {
        if (!topic) return;
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0, percentage: 0 };
        topicStats[topic].total   += 1;
        topicStats[topic].correct += 1; // correct
      });

      // If no topic arrays but has a score, use a general bucket
      if (
        (!result.weakTopics?.length && !result.strongTopics?.length) &&
        result.score !== undefined
      ) {
        const topic = 'general';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0, percentage: 0 };
        topicStats[topic].total   += 1;
        topicStats[topic].correct += score >= 60 ? 1 : 0;
      }
    }
  });

  // Calculate percentages
  Object.keys(topicStats).forEach(topic => {
    const s = topicStats[topic];
    s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  });

  return topicStats;
};

// ============================================================
// HELPER: Detect Student Level
// ============================================================
const detectStudentLevel = (overallScore, weakTopicCount, strongTopicCount) => {
  if (overallScore >= 80 && weakTopicCount === 0) return 'advanced';
  if (overallScore >= 60 && weakTopicCount <= 2)  return 'intermediate';
  return 'beginner';
};

// ============================================================
// HELPER: Build Recommendation Items
// ============================================================
const buildRecommendationItems = async ({
  studentId, weakTopics, strongTopics, overallScore,
  detectedLevel, courseIds, completedLessonIds, results,
}) => {
  const items = [];

  // STRATEGY 1: Lessons for weak topics
  if (weakTopics.length > 0) {
    const weakTopicNames = weakTopics.map(t => t.topic);

    const weakLessons = await Lesson.find({
      course:      { $in: courseIds },
      topics:      { $in: weakTopicNames },
      isPublished: true,
    })
      .populate('course', 'title level')
      .populate('module', 'title')
      .limit(20);

    for (const lesson of weakLessons) {
      if (!lesson || !lesson._id) continue; // FIX: null guard
      if (completedLessonIds.has(lesson._id.toString())) continue;

      const addressedWeakTopics = weakTopics.filter(wt => lesson.topics?.includes(wt.topic));
      if (!addressedWeakTopics.length) continue;

      const weakestTopic = addressedWeakTopics[0];
      const confidence   = calculateConfidence(weakestTopic.score, addressedWeakTopics.length);
      const explanation  = generateLessonExplanation(weakestTopic, lesson, addressedWeakTopics);

      items.push({
        type:           'lesson',
        itemId:         lesson._id,
        itemModel:      'Lesson',
        explanation,
        addressesTopic: weakestTopic.topic,
        confidence,
        priority:       Math.round((100 - weakestTopic.score) / 10),
        reasonFactors: [
          { factor: 'weak_topic',       value: weakestTopic.score,        description: `Your score on "${weakestTopic.topic}" is ${weakestTopic.score}%` },
          { factor: 'lesson_relevance', value: addressedWeakTopics.length, description: `This lesson covers ${addressedWeakTopics.length} of your weak topic(s)` },
        ],
      });
    }
  }

  // STRATEGY 2: Quizzes on weak topics
  if (weakTopics.length > 0) {
    const weakTopicNames = weakTopics.map(t => t.topic);

    const practiceQuizzes = await Quiz.find({
      course:        { $in: courseIds },
      topicsTested:  { $in: weakTopicNames },
      isPublished:   true,
    })
      .populate('course', 'title')
      .limit(5);

    for (const quiz of practiceQuizzes) {
      if (!quiz || !quiz._id) continue; // FIX: null guard

      const addressedWeakTopics = weakTopics.filter(wt => quiz.topicsTested?.includes(wt.topic));
      if (!addressedWeakTopics.length) continue;

      const weakestTopic  = addressedWeakTopics[0];
      const recentPassed  = results.find(r =>
        r.quiz?.toString() === quiz._id.toString() && (r.score || r.scorePercentage || 0) >= 70
      );
      if (recentPassed) continue;

      items.push({
        type:           'quiz',
        itemId:         quiz._id,
        itemModel:      'Quiz',
        explanation:    `Practice quiz: You scored ${weakestTopic.score}% on "${weakestTopic.topic}". Retaking this quiz will reinforce your understanding.`,
        addressesTopic: weakestTopic.topic,
        confidence:     75,
        priority:       5,
        reasonFactors: [
          { factor: 'practice_needed', value: weakestTopic.score, description: `Low score of ${weakestTopic.score}% on "${weakestTopic.topic}"` },
        ],
      });
    }
  }

  // STRATEGY 3: Advanced content for strong topics
  if (strongTopics.length > 0 && detectedLevel !== 'beginner') {
    const strongTopicNames = strongTopics.map(t => t.topic);

    const advancedLessons = await Lesson.find({
      course:      { $in: courseIds },
      topics:      { $in: strongTopicNames },
      isPublished: true,
    })
      .populate('course', 'title level')
      .limit(3);

    for (const lesson of advancedLessons) {
      if (!lesson || !lesson._id) continue;
      if (completedLessonIds.has(lesson._id.toString())) continue;

      const addressedStrongTopics = strongTopics.filter(st => lesson.topics?.includes(st.topic));
      if (!addressedStrongTopics.length) continue;

      const strongestTopic = addressedStrongTopics[0];
      items.push({
        type:           'lesson',
        itemId:         lesson._id,
        itemModel:      'Lesson',
        explanation:    `Advanced content: You're doing great with "${strongestTopic.topic}" (${strongestTopic.score}%). This lesson will help you go even deeper.`,
        addressesTopic: strongestTopic.topic,
        confidence:     65,
        priority:       2,
        reasonFactors: [
          { factor: 'strong_topic_advancement', value: strongestTopic.score, description: `Excellent score of ${strongestTopic.score}% on "${strongestTopic.topic}"` },
        ],
      });
    }
  }

  // STRATEGY 4: Fallback — next unfinished lesson
  if (items.length === 0) {
    const nextLesson = await Lesson.findOne({
      course:      { $in: courseIds },
      _id:         { $nin: [...completedLessonIds] },
      isPublished: true,
    })
      .populate('course', 'title')
      .sort({ order: 1 });

    if (nextLesson && nextLesson._id) {
      items.push({
        type:           'lesson',
        itemId:         nextLesson._id,
        itemModel:      'Lesson',
        explanation:    `Continue your learning journey! This is the next lesson in your course. Your overall performance is ${overallScore}% — keep it up!`,
        addressesTopic: nextLesson.topics?.[0] || 'general',
        confidence:     80,
        priority:       5,
        reasonFactors: [
          { factor: 'next_in_sequence', value: overallScore, description: `Next unfinished lesson in your enrolled course` },
        ],
      });
    }
  }

  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, MAX_RECOMMENDATIONS);
};

// ============================================================
// HELPERS
// ============================================================
const calculateConfidence = (topicScore, topicsAddressed) => {
  let confidence = 100 - topicScore;
  confidence += topicsAddressed * 5;
  return Math.min(Math.round(confidence), 99);
};

const generateLessonExplanation = (weakestTopic, lesson, addressedWeakTopics) => {
  const scoreLabel = weakestTopic.score < 40 ? 'struggling' : 'need improvement';
  const topicsList = addressedWeakTopics.map(t => `"${t.topic}"`).join(', ');
  if (weakestTopic.score < 40)
    return `You are ${scoreLabel} with ${topicsList} (score: ${weakestTopic.score}%). "${lesson.title}" directly covers this topic and will strengthen your understanding.`;
  if (weakestTopic.score < 60)
    return `Based on your quiz results, your score in ${topicsList} is ${weakestTopic.score}%. We recommend "${lesson.title}" to help you improve.`;
  return `Your performance analysis shows a gap in ${topicsList}. Completing "${lesson.title}" will help fill this knowledge gap.`;
};

// ============================================================
// GET LATEST RECOMMENDATION
// ============================================================
const getLatestRecommendation = async (studentId) => {
  const recommendation = await Recommendation.findOne({
    student:    studentId,
    isActive:   true,
    validUntil: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate({
      path:   'recommendations.itemId',
      select: 'title description topics contentType module course estimatedDuration',
    });
  return recommendation;
};

module.exports = { generateRecommendations, getLatestRecommendation, aggregateTopicPerformance };