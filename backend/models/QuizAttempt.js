// models/QuizAttempt.js
// ─────────────────────────────────────────────────────────────
// Records every student quiz attempt.
// Powers the analytics and explainable-recommendation engine.
// ─────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

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
  },
  { timestamps: true }
);

quizAttemptSchema.index({ quiz: 1, student: 1 });
quizAttemptSchema.index({ student: 1, course: 1 });
quizAttemptSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);