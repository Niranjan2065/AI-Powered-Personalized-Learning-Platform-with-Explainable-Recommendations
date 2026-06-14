// ============================================================
// models/Progress.js - Student Progress Tracking Model
// ============================================================
// Tracks fine-grained progress: lesson views, time spent, etc.
// This is the core data source for the AI recommendation engine.
// Updated: Added Spaced Repetition (Forgetting Curve) fields.

const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema(
  {
    // ── Core References ──────────────────────────────────────
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    course: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: true,
    },

    lesson: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Lesson',
      required: true,
    },

    module: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Module',
      required: true,
    },

    // ── Completion Status ────────────────────────────────────
    isCompleted: {
      type:    Boolean,
      default: false,
    },

    completedAt: {
      type:    Date,
      default: null,
    },

    // ── Time Tracking ────────────────────────────────────────
    timeSpent: {
      type:    Number,
      default: 0,
    },

    visitCount: {
      type:    Number,
      default: 0,
    },

    lastAccessedAt: {
      type:    Date,
      default: Date.now,
    },

    // ── Video Progress ───────────────────────────────────────
    videoProgress: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },

    // ── Notes ────────────────────────────────────────────────
    notes: {
      type:      String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default:   '',
    },

    // ── Bookmarked ───────────────────────────────────────────
    isBookmarked: {
      type:    Boolean,
      default: false,
    },

    // ── Spaced Repetition (Forgetting Curve) ─────────────────
    // Populated by forgettingCurve.js → updateReviewSchedule()
    // after every quiz attempt on this lesson.
    //
    // srReviewCount      — how many times the SR scheduler has run for this lesson
    // srLastScore        — quiz score that triggered the last schedule update (0-100)
    // srLastIntervalDays — interval used in the last schedule (days)
    // srNextReviewAt     — when the student should review this lesson next
    //
    // Existing documents will have these as undefined; code uses `?? 0` fallbacks
    // so no data migration script is required.

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
      // Indexed below — queried on every recommendation generation
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================
ProgressSchema.index({ student: 1, lesson: 1 }, { unique: true });
ProgressSchema.index({ student: 1, course: 1 });
// SR index: lets getTopicsNeedingReview() run a fast range query
ProgressSchema.index({ student: 1, srNextReviewAt: 1, isCompleted: 1 });

module.exports = mongoose.model('Progress', ProgressSchema);