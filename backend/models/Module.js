// ============================================================
// models/Module.js - Module Schema & Model
// ============================================================
// Modules are sections/chapters inside a Course
// Each module contains multiple Lessons

const mongoose = require('mongoose');

const ModuleSchema = new mongoose.Schema(
  {
    // ---- Basic Info ----
    title: {
      type: String,
      required: [true, 'Module title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },

    // ---- Parent Course Reference ----
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Module must belong to a course'],
    },

    // ---- Ordering ----
    // Position of this module within the course (1, 2, 3...)
    order: {
      type: Number,
      required: [true, 'Module order is required'],
      default: 1,
    },

    // ---- Topics ----
    // Topics covered in this module (used by AI for weak-area detection)
    topics: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // ---- Status ----
    isPublished: {
      type: Boolean,
      default: false,
    },

    // ---- Duration ----
    estimatedDuration: {
      type: Number,
      default: 0, // in minutes
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================================
// INDEXES
// ============================================================
ModuleSchema.index({ course: 1, order: 1 });

// ============================================================
// VIRTUALS
// ============================================================

// Virtual: Get lessons in this module
ModuleSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'module',
  justOne: false,
});

// Virtual: Get quiz for this module
ModuleSchema.virtual('quizzes', {
  ref: 'Quiz',
  localField: '_id',
  foreignField: 'module',
  justOne: false,
});

module.exports = mongoose.model('Module', ModuleSchema);
