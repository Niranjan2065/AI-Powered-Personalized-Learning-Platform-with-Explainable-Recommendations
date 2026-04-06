// models/Quiz.js
// ─────────────────────────────────────────────────────────────
// Unified schema for both manual and AI-generated quizzes.
// isAIGenerated flag lets admins audit / filter AI content.
// ─────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

// ── Sub-schema: one answer option (MCQ) ──────────────────────
const optionSchema = new mongoose.Schema(
  {
    text:      { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

// ── Sub-schema: one question ──────────────────────────────────
const questionSchema = new mongoose.Schema(
  {
    type: {
      type:     String,
      enum:     ['mcq', 'true_false', 'short_answer'],
      required: true,
    },
    questionText:  { type: String, required: true, trim: true },
    options:       { type: [optionSchema], default: [] },   // MCQ only
    correctAnswer: { type: String, default: '' },           // true_false / short_answer
    explanation:   { type: String, default: '' },           // AI always populates this
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    points:        { type: Number, default: 1, min: 1, max: 10 },
    topic:         { type: String, default: '' },           // AI tags the topic
    bloomLevel:    {                                        // AI tags cognitive level
      type:    String,
      enum:    ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create', ''],
      default: '',
    },
  },
  { _id: true }
);

// ── Main quiz schema ──────────────────────────────────────────
const quizSchema = new mongoose.Schema(
  {
    lesson:  { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson',  required: true },
    course:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course',  required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },

    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    questions:   { type: [questionSchema], default: [] },

    // Settings
    timeLimit:    { type: Number, default: 0, min: 0 },   // minutes; 0 = no limit
    passingScore: { type: Number, default: 70, min: 0, max: 100 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions:   { type: Boolean, default: true },
    maxAttempts:  { type: Number, default: 0 },           // 0 = unlimited

    // Lifecycle
    isPublished:    { type: Boolean, default: false },
    publishedAt:    { type: Date },

    // AI metadata
    isAIGenerated:  { type: Boolean, default: false },
    aiModel:        { type: String, default: '' },
    aiGeneratedAt:  { type: Date },
    aiSourceType:   { type: String, enum: ['lesson_text', 'pdf', 'video_transcript', 'manual', ''], default: '' },
    aiPromptConfig: {                                     // stores what was requested
      numQuestions: Number,
      difficulty:   String,
      types:        [String],
      focusArea:    String,
    },

    // Analytics (updated by quiz-attempt service)
    totalAttempts:    { type: Number, default: 0 },
    averageScore:     { type: Number, default: 0 },
    completionRate:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
quizSchema.index({ lesson: 1, isPublished: 1 });
quizSchema.index({ course: 1 });
quizSchema.index({ creator: 1 });
quizSchema.index({ isAIGenerated: 1, createdAt: -1 });

// ── Virtuals ──────────────────────────────────────────────────
quizSchema.virtual('questionCount').get(function () {
  return this.questions.length;
});

quizSchema.virtual('totalPoints').get(function () {
  return this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
});

quizSchema.set('toJSON', { virtuals: true });
quizSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Quiz', quizSchema);