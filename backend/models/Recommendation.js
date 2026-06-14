// ============================================================
// models/Recommendation.js
// Updated Phase 12: added isReviewDue flag on items + reviewDueCount
// on analysisSummary so the frontend can render the SR badge.
// ============================================================
const mongoose = require('mongoose');

const RecommendationItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['lesson', 'quiz', 'course', 'module'],
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recommendations.itemModel',
  },
  itemModel: {
    type: String,
    enum: ['Lesson', 'Quiz', 'Course', 'Module'],
    required: true,
  },

  // ── Explainable AI fields ────────────────────────────────
  explanation: {
    type: String,
    required: true,
  },
  addressesTopic: {
    type: String,
    default: '',
  },
  confidence: {
    type: Number,
    default: 70,
    min: 0,
    max: 100,
  },
  reasonFactors: [
    {
      factor:      String,
      value:       mongoose.Schema.Types.Mixed,
      description: String,
    },
  ],
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },

  // ── Step 2: Spaced Repetition flag ───────────────────────
  // true  → this item was surfaced by the forgetting curve scheduler
  //         (frontend renders the "📅 Due for Review" badge)
  // false → normal ML / rule-based recommendation
  isReviewDue: {
    type:    Boolean,
    default: false,
  },

  // ── Student interaction flags ─────────────────────────────
  isViewed: {
    type:    Boolean,
    default: false,
  },
  isDismissed: {
    type:    Boolean,
    default: false,
  },
  isCompleted: {
    type:    Boolean,
    default: false,
  },
});

const RecommendationSchema = new mongoose.Schema(
  {
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    recommendations: [RecommendationItemSchema],

    analysisSummary: {
      overallScore: {
        type:    Number,
        default: 0,
      },
      weakTopics: [
        {
          topic:        String,
          score:        Number,
          quizzesTaken: Number,
        },
      ],
      strongTopics: [
        {
          topic:        String,
          score:        Number,
          quizzesTaken: Number,
        },
      ],
      detectedLevel: {
        type:    String,
        enum:    ['beginner', 'intermediate', 'advanced'],
        default: 'beginner',
      },
      coursesAnalyzed: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref:  'Course',
        },
      ],
      totalQuizzesAnalyzed: {
        type:    Number,
        default: 0,
      },

      // ── Step 2: SR summary fields ───────────────────────
      // reviewDueCount — how many SR review items were injected into
      // this recommendation set. Frontend uses this for the badge number.
      reviewDueCount: {
        type:    Number,
        default: 0,
      },
    },

    generatedBy: {
      type:    String,
      default: 'rule-based-v1',
    },
    validUntil: {
      type:    Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ============================================================
// Indexes
// ============================================================
RecommendationSchema.index({ student: 1 });
RecommendationSchema.index({ student: 1, isActive: 1 });
RecommendationSchema.index({ validUntil: 1 });

module.exports = mongoose.model('Recommendation', RecommendationSchema);