// models/QuizAttempt.js
// ─────────────────────────────────────────────────────────────
// Records every student quiz attempt.
// Powers the analytics and explainable-recommendation engine.
// Updated: Added anti-cheating / proctoring fields.
// ─────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

// Sub-schema for individual violation events
const violationSchema = new mongoose.Schema(
  {
    type:      { type: String },  // 'tab_switch' | 'window_blur' | 'copy_attempt' | etc.
    message:   { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const answerSchema = new mongoose.Schema(
  {
    questionId:    { type: mongoose.Schema.Types.ObjectId, required: true },
    questionText:  { type: String },
    selectedOption: { type: String },     // MCQ: selected text
    selectedAnswer: { type: String },     // true_false / short_answer
    isCorrect:     { type: Boolean },
    pointsEarned:  { type: Number, default: 0 },
    timeTaken:     { type: Number, default: 0 }, // seconds
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz:    { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz',   required: true },
    lesson:  { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    course:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },

    answers:      [answerSchema],
    score:        { type: Number, default: 0 },        // percentage
    pointsEarned: { type: Number, default: 0 },
    totalPoints:  { type: Number, default: 0 },
    isPassed:     { type: Boolean, default: false },
    timeTaken:    { type: Number, default: 0 },        // total seconds
    completedAt:  { type: Date },
    attemptNumber:{ type: Number, default: 1 },

    // Weak areas identified — fed into recommendation engine
    weakTopics:   [String],
    strongTopics: [String],

    // ── Anti-cheating / Proctoring ────────────────────────────
    isFlagged:           { type: Boolean, default: false },       // true if violations detected
    violationCount:      { type: Number,  default: 0 },           // total violations recorded
    violations:          [violationSchema],                        // detailed violation log
    terminatedByProctor: { type: Boolean, default: false },       // true if quiz was force-submitted
  },
  { timestamps: true }
);

quizAttemptSchema.index({ quiz: 1, student: 1 });
quizAttemptSchema.index({ student: 1, course: 1 });
quizAttemptSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);