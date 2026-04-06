// ============================================================
// models/Progress.js - Student Progress Tracking Model
// ============================================================
// Tracks fine-grained progress: lesson views, time spent, etc.
// This is the core data source for the AI recommendation engine

const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema(
  {
    // ---- Core References ----
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
    },

    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
    },

    // ---- Completion Status ----
    isCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // ---- Time Tracking ----
    // Total time spent on this lesson (minutes)
    timeSpent: {
      type: Number,
      default: 0,
    },

    // Number of times the student has visited this lesson
    visitCount: {
      type: Number,
      default: 0,
    },

    // Last time the student accessed this lesson
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },

    // ---- Video Progress (if content is video) ----
    // How far through the video (0-100%)
    videoProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ---- Notes ----
    // Student's personal notes on this lesson
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: '',
    },

    // ---- Bookmarked ----
    isBookmarked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================
// Compound unique index: one progress record per student per lesson
ProgressSchema.index({ student: 1, lesson: 1 }, { unique: true });
ProgressSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model('Progress', ProgressSchema);
