// ============================================================
// models/Lesson.js - Lesson Schema & Model
// ============================================================
// Lessons are individual learning units inside a Module
// Supports video, PDF, and text content types

const mongoose = require('mongoose');

const LessonSchema = new mongoose.Schema(
  {
    // ---- Basic Info ----
    title: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },

    // ---- Parent References ----
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: [true, 'Lesson must belong to a module'],
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Lesson must belong to a course'],
    },

    // ---- Content Type ----
    // Determines what content field to use
    contentType: {
      type: String,
      enum: ['video', 'pdf', 'text', 'mixed'],
      required: [true, 'Content type is required'],
      default: 'text',
    },

    // ---- Content Data ----
    content: {
      // For text lessons: the actual content
      text: {
        type: String,
        default: '',
      },

      // For video lessons: URL (YouTube, Vimeo, or uploaded)
      videoUrl: {
        type: String,
        default: '',
      },

      // Video duration in seconds
      videoDuration: {
        type: Number,
        default: 0,
      },

      // For PDF lessons: URL to the PDF file
      pdfUrl: {
        type: String,
        default: '',
      },

      // Additional resources
      resources: [
        {
          title: String,
          url: String,
          type: {
            type: String,
            enum: ['link', 'pdf', 'image', 'other'],
          },
        },
      ],
    },

    // ---- Ordering ----
    order: {
      type: Number,
      default: 1,
    },

    // ---- Duration ----
    estimatedDuration: {
      type: Number,
      default: 10, // minutes
    },

    // ---- Topics ----
    // Specific topics this lesson covers (used by AI for weak-area matching)
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

    isFree: {
      type: Boolean,
      default: false, // Preview lessons can be free
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
LessonSchema.index({ module: 1, order: 1 });
LessonSchema.index({ course: 1 });
LessonSchema.index({ topics: 1 }); // For AI weak-topic matching

module.exports = mongoose.model('Lesson', LessonSchema);
