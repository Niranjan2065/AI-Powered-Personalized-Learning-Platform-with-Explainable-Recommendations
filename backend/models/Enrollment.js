// ============================================================
// models/Enrollment.js - Enrollment Schema & Model
// ============================================================
// Tracks which students are enrolled in which courses
// Also tracks overall course completion progress

const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema(
  {
    // ---- Core References ----
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Enrollment must have a student'],
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Enrollment must be for a course'],
    },

    // ---- Progress Tracking ----
    // Percentage of the course completed (0-100)
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // List of completed lesson IDs
    completedLessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
      },
    ],

    // List of completed module IDs
    completedModules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
      },
    ],

    // Currently active lesson (last opened)
    currentLesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      default: null,
    },

    // ---- Time Tracking ----
    // Total time spent on this course (in minutes)
    totalTimeSpent: {
      type: Number,
      default: 0,
    },

    // Last time the student accessed this course
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },

    // ---- Status ----
    status: {
      type: String,
      enum: ['active', 'completed', 'dropped', 'paused'],
      default: 'active',
    },

    // Date when student completed the full course
    completedAt: {
      type: Date,
      default: null,
    },

    // ---- Payment Info (if course is paid) ----
    paymentStatus: {
      type: String,
      enum: ['free', 'paid', 'refunded'],
      default: 'free',
    },

    amountPaid: {
      type: Number,
      default: 0,
    },

    // ---- Rating given by student ----
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    review: {
      type: String,
      maxlength: [500, 'Review cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================
// Compound index to prevent duplicate enrollments
EnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
EnrollmentSchema.index({ student: 1 });
EnrollmentSchema.index({ course: 1 });

// ============================================================
// INSTANCE METHODS
// ============================================================

/**
 * Mark a lesson as completed and update completion percentage
 */
EnrollmentSchema.methods.markLessonComplete = function (
  lessonId,
  totalLessons
) {
  // Add lesson to completed list if not already there
  if (!this.completedLessons.includes(lessonId)) {
    this.completedLessons.push(lessonId);
  }

  // Recalculate completion percentage
  if (totalLessons > 0) {
    this.completionPercentage = Math.round(
      (this.completedLessons.length / totalLessons) * 100
    );
  }

  // Mark as completed if 100%
  if (this.completionPercentage >= 100) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
};

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
