// ============================================================
// models/Result.js - Quiz Result Schema & Model
// ============================================================
// Stores every quiz attempt by a student
// This data feeds the AI recommendation engine

const mongoose = require('mongoose');

// Schema for individual answer in a quiz attempt
const AnswerSchema = new mongoose.Schema({
  // Reference to the question
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  // The topic this question was about (copied from question for fast access)
  topic: {
    type: String,
    default: '',
  },

  // Student's selected answer (option index or text)
  selectedAnswer: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  // Whether the answer was correct
  isCorrect: {
    type: Boolean,
    required: true,
  },

  // Points earned for this answer
  pointsEarned: {
    type: Number,
    default: 0,
  },

  // Time taken to answer this question (seconds)
  timeTaken: {
    type: Number,
    default: 0,
  },
});

const ResultSchema = new mongoose.Schema(
  {
    // ---- Core References ----
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Result must have a student'],
    },

    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Result must reference a quiz'],
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
    },

    // ---- Attempt Info ----
    attemptNumber: {
      type: Number,
      default: 1,
    },

    // ---- Answers ----
    answers: [AnswerSchema],

    // ---- Scores ----
    totalPoints: {
      type: Number,
      required: true,
    },

    pointsEarned: {
      type: Number,
      default: 0,
    },

    // Score as percentage (0-100)
    scorePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Whether student passed (based on quiz passingScore)
    isPassed: {
      type: Boolean,
      default: false,
    },

    // ---- Time Tracking ----
    // Total time taken for the quiz (in seconds)
    timeTaken: {
      type: Number,
      default: 0,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    // ---- Topic Performance ----
    // AI uses this to identify weak/strong topics
    // e.g., { "arrays": { correct: 2, total: 3 }, "loops": { correct: 1, total: 2 } }
    topicPerformance: {
      type: Map,
      of: new mongoose.Schema({
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
      }),
      default: {},
    },

    // ---- Status ----
    status: {
      type: String,
      enum: ['in-progress', 'submitted', 'graded'],
      default: 'submitted',
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================
ResultSchema.index({ student: 1, quiz: 1 });
ResultSchema.index({ student: 1, course: 1 });
ResultSchema.index({ student: 1 });

// ============================================================
// PRE-SAVE MIDDLEWARE
// ============================================================

/**
 * Auto-calculate topic performance before saving
 * This aggregates performance per topic for AI analysis
 */
ResultSchema.pre('save', function (next) {
  if (this.answers && this.answers.length > 0) {
    const topicStats = {};

    this.answers.forEach((answer) => {
      const topic = answer.topic || 'general';

      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0, percentage: 0 };
      }

      topicStats[topic].total += 1;
      if (answer.isCorrect) {
        topicStats[topic].correct += 1;
      }
    });

    // Calculate percentage for each topic
    Object.keys(topicStats).forEach((topic) => {
      const stats = topicStats[topic];
      stats.percentage = Math.round((stats.correct / stats.total) * 100);
    });

    this.topicPerformance = topicStats;
  }

  // Calculate overall score percentage
  if (this.totalPoints > 0) {
    this.scorePercentage = Math.round(
      (this.pointsEarned / this.totalPoints) * 100
    );
  }

  next();
});

module.exports = mongoose.model('Result', ResultSchema);
