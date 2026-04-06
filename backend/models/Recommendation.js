// ============================================================
// models/Recommendation.js - AI Recommendation Model
// ============================================================
// Stores AI-generated personalized learning path recommendations
// Includes explanations for WHY each recommendation was made (XAI)

const mongoose = require('mongoose');

// Schema for a single recommendation item
const RecommendationItemSchema = new mongoose.Schema({
  // Type of recommendation
  type: {
    type: String,
    enum: ['lesson', 'quiz', 'course', 'module'],
    required: true,
  },

  // Reference to the recommended item
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recommendations.itemModel',
  },

  // Dynamic reference model name
  itemModel: {
    type: String,
    enum: ['Lesson', 'Quiz', 'Course', 'Module'],
    required: true,
  },

  // ---- EXPLAINABLE AI FIELDS ----
  // Human-readable explanation for WHY this was recommended
  // Example: "You scored 40% on Arrays in your last quiz. This lesson will help strengthen that topic."
  explanation: {
    type: String,
    required: true,
  },

  // The weak topic this recommendation addresses
  addressesTopic: {
    type: String,
    default: '',
  },

  // Confidence score of this recommendation (0-100)
  confidence: {
    type: Number,
    default: 70,
    min: 0,
    max: 100,
  },

  // Why factors (structured breakdown for detailed explanation)
  reasonFactors: [
    {
      factor: String,       // e.g., "low_quiz_score"
      value: mongoose.Schema.Types.Mixed,  // e.g., 40
      description: String, // e.g., "Quiz score of 40% in Arrays"
    },
  ],

  // Priority of this recommendation
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },

  // Whether student has acted on this recommendation
  isViewed: {
    type: Boolean,
    default: false,
  },

  isDismissed: {
    type: Boolean,
    default: false,
  },

  isCompleted: {
    type: Boolean,
    default: false,
  },
});

const RecommendationSchema = new mongoose.Schema(
  {
    // ---- Core References ----
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ---- Recommendation List ----
    recommendations: [RecommendationItemSchema],

    // ---- Analysis Summary ----
    // Summary of student's performance that led to these recommendations
    analysisSummary: {
      // Overall performance score (0-100)
      overallScore: {
        type: Number,
        default: 0,
      },

      // Topics where student is weak (score < 60%)
      weakTopics: [
        {
          topic: String,
          score: Number,        // percentage
          quizzesTaken: Number,
        },
      ],

      // Topics where student is strong (score >= 80%)
      strongTopics: [
        {
          topic: String,
          score: Number,
          quizzesTaken: Number,
        },
      ],

      // Student's current learning level (set by AI)
      detectedLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner',
      },

      // Courses analyzed to generate these recommendations
      coursesAnalyzed: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Course',
        },
      ],

      // Total quizzes analyzed
      totalQuizzesAnalyzed: {
        type: Number,
        default: 0,
      },
    },

    // ---- AI Model Info ----
    // Which AI model/version generated this
    generatedBy: {
      type: String,
      default: 'rule-based-v1', // Will change as we upgrade AI
    },

    // ---- Validity ----
    // Recommendations expire after a certain period
    validUntil: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================
RecommendationSchema.index({ student: 1 });
RecommendationSchema.index({ student: 1, isActive: 1 });
RecommendationSchema.index({ validUntil: 1 });

module.exports = mongoose.model('Recommendation', RecommendationSchema);
