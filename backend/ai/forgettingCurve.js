// backend/ai/forgettingCurve.js
// ─────────────────────────────────────────────────────────────────────────────
// Ebbinghaus Forgetting Curve Scheduler
//
// What it does:
//   After every quiz attempt or lesson completion, it calculates WHEN the
//   student should review that topic next — based on their score and how many
//   times they've already reviewed it.
//
// How it integrates:
//   - Called from quizController.submitAttempt (after scoring)
//   - Called from progressController when a lesson is marked complete
//   - getTopicsNeedingReview() is called by recommendationController to
//     surface "due for review" items at the top of the learning path
//
// Schema additions needed (see bottom of this file):
//   QuizAttempt  — no changes required
//   Progress     — add spaced repetition fields (migration note below)
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// Core algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the ease factor for a given score (0-100).
 * Higher scores → longer intervals before next review.
 *
 *  score ≥ 80  → ease 2.5  (good retention, stretch the interval)
 *  score ≥ 60  → ease 2.0  (average, moderate interval)
 *  score ≥ 40  → ease 1.5  (shaky, review sooner)
 *  score < 40  → ease 1.3  (poor, review very soon)
 */
function easeFactor(score) {
  if (score >= 80) return 2.5;
  if (score >= 60) return 2.0;
  if (score >= 40) return 1.5;
  return 1.3;
}

/**
 * Calculate the next review interval in DAYS.
 *
 * SM-2 inspired (simplified for EdTech context):
 *   reviewCount 0 → review tomorrow          (1 day)
 *   reviewCount 1 → review in 3 days
 *   reviewCount 2+ → previous interval × ease factor
 *
 * @param {number} score              - Quiz/lesson score 0-100
 * @param {number} reviewCount        - How many times reviewed so far (0 = first time)
 * @param {number} lastIntervalDays   - The interval used last time (0 if first review)
 * @returns {number} days until next review (minimum 1)
 */
function computeNextIntervalDays(score, reviewCount, lastIntervalDays = 0) {
  const ease = easeFactor(score);

  let interval;
  if (reviewCount === 0) {
    interval = 1;                               // first review: tomorrow
  } else if (reviewCount === 1) {
    interval = 3;                               // second review: 3 days later
  } else {
    // Subsequent: grow exponentially by ease, but cap at 60 days
    interval = Math.round(lastIntervalDays * ease);
  }

  // Floor at 1 day, cap at 60 days
  return Math.max(1, Math.min(interval, 60));
}

/**
 * Return a Date object for when the next review is due.
 *
 * @param {number} score
 * @param {number} reviewCount
 * @param {number} lastIntervalDays
 * @returns {Date}
 */
function nextReviewDate(score, reviewCount, lastIntervalDays = 0) {
  const days = computeNextIntervalDays(score, reviewCount, lastIntervalDays);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress record updater
// Called after a quiz attempt on a lesson to update the SR fields on Progress.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the spaced-repetition fields on the Progress record for a lesson
 * after the student completes a quiz on that lesson.
 *
 * Creates the Progress record if it doesn't exist yet.
 *
 * @param {ObjectId|string} studentId
 * @param {ObjectId|string} lessonId
 * @param {ObjectId|string} courseId
 * @param {ObjectId|string} moduleId   - can be null; looked up from lesson if absent
 * @param {number}          score      - quiz score 0-100
 * @returns {Promise<object>}  the updated SR fields { nextReviewAt, reviewCount, lastIntervalDays }
 */
async function updateReviewSchedule(studentId, lessonId, courseId, moduleId, score) {
  const Progress = require('../models/Progress'); // lazy — keeps pure functions testable without mongoose
  // Find existing progress record (upsert-safe)
  let progress = await Progress.findOne({ student: studentId, lesson: lessonId });

  if (!progress) {
    // No lesson progress yet — create a minimal one
    // moduleId is required by the schema; look it up from the lesson if not provided
    let resolvedModuleId = moduleId;
    if (!resolvedModuleId) {
      const Lesson = require('../models/Lesson');
      const lesson = await Lesson.findById(lessonId).select('module').lean();
      resolvedModuleId = lesson?.module || lessonId; // last-resort fallback
    }

    progress = new Progress({
      student:  studentId,
      lesson:   lessonId,
      course:   courseId,
      module:   resolvedModuleId,
      // SR fields initialised below
    });
  }

  // Current SR state (default to 0 if fields not yet on the document)
  const currentReviewCount    = progress.srReviewCount    ?? 0;
  const currentLastInterval   = progress.srLastIntervalDays ?? 0;

  const nextInterval = computeNextIntervalDays(score, currentReviewCount, currentLastInterval);
  const due          = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000);

  // Write SR fields — these are added to Progress via schema migration (see note below)
  progress.srReviewCount      = currentReviewCount + 1;
  progress.srLastScore        = score;
  progress.srLastIntervalDays = nextInterval;
  progress.srNextReviewAt     = due;
  progress.lastAccessedAt     = new Date();

  await progress.save();

  return {
    nextReviewAt:     due,
    reviewCount:      progress.srReviewCount,
    lastIntervalDays: nextInterval,
    score,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Query: which lessons are due for review right now?
// Called by recommendationController to inject "review due" items at the top
// of the learning path, ranked by most overdue first.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all Progress records for a student where srNextReviewAt is in the past.
 * Sorted most-overdue first, limited to `limit` items.
 *
 * @param {ObjectId|string} studentId
 * @param {number}          limit     default 5
 * @returns {Promise<Array>}  populated Progress docs
 */
async function getTopicsNeedingReview(studentId, limit = 5) {
  const Progress = require('../models/Progress'); // lazy
  const now = new Date();

  const due = await Progress.find({
    student:        studentId,
    srNextReviewAt: { $lte: now },    // review is overdue
    srReviewCount:  { $gt: 0 },       // must have been reviewed at least once
    isCompleted:    true,             // only completed lessons enter the SR queue
  })
    .sort({ srNextReviewAt: 1 })      // most overdue first
    .limit(limit)
    .populate('lesson', 'title topics order')
    .populate('course', 'title')
    .lean();

  return due.map(p => ({
    lessonId:        p.lesson?._id,
    lessonTitle:     p.lesson?.title  || 'Lesson',
    courseTitle:     p.course?.title  || 'Course',
    topics:          p.lesson?.topics || [],
    lastScore:       p.srLastScore,
    daysSinceReview: Math.floor((now - new Date(p.srNextReviewAt)) / (24 * 60 * 60 * 1000)),
    reviewCount:     p.srReviewCount,
    progressId:      p._id,
  }));
}

/**
 * Quick summary: how many lessons are currently due for review?
 * Used by the dashboard stats card.
 *
 * @param {ObjectId|string} studentId
 * @returns {Promise<number>}
 */
async function countDueReviews(studentId) {
  const Progress = require('../models/Progress'); // lazy
  return Progress.countDocuments({
    student:        studentId,
    srNextReviewAt: { $lte: new Date() },
    srReviewCount:  { $gt: 0 },
    isCompleted:    true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Core algorithm (pure functions — no DB, easy to unit-test)
  computeNextIntervalDays,
  nextReviewDate,
  easeFactor,

  // DB operations
  updateReviewSchedule,
  getTopicsNeedingReview,
  countDueReviews,
};

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION NOTE — add these fields to models/Progress.js
// ─────────────────────────────────────────────────────────────────────────────
/*
  Add inside ProgressSchema, after the existing `isBookmarked` field:

  // ── Spaced Repetition (Forgetting Curve) ──────────────────────────────────
  srReviewCount: {
    type:    Number,
    default: 0,
  },
  srLastScore: {
    type:    Number,
    default: null,
  },
  srLastIntervalDays: {
    type:    Number,
    default: 0,
  },
  srNextReviewAt: {
    type:    Date,
    default: null,
    index:   true,       // queried frequently in getTopicsNeedingReview
  },

  Existing MongoDB documents will have these fields as undefined, which the
  code handles safely via the `?? 0` / `?? null` fallbacks.
  No data migration script is needed — the fields self-initialise on first use.
*/