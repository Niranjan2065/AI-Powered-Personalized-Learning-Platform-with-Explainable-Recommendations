// ============================================================
// models/Course.js - Course Schema & Model
// ============================================================
// Tutor creates a course with metadata
// Modules and Lessons are separate models referencing this

const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema(
  {
    // ---- Basic Info ----
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      required: [true, 'Course description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    shortDescription: {
      type: String,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },

    // ---- Categorization ----
    category: {
      type: String,
      required: [true, 'Course category is required'],
      enum: [
        'programming',
        'mathematics',
        'science',
        'language',
        'arts',
        'business',
        'data-science',
        'web-development',
        'machine-learning',
        'other',
      ],
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // ---- Difficulty Level ----
    // Used by AI to match with student's learning level
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: [true, 'Course level is required'],
    },

    // ---- Media ----
    thumbnail: {
      type: String,
      default: '',
    },

    // ---- Tutor (Owner) ----
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Course must have a tutor'],
    },

    // ---- Course Status ----
    isPublished: {
      type: Boolean,
      default: false, // Tutor must explicitly publish
    },

    // ---- Pricing ----
    price: {
      type: Number,
      default: 0, // 0 = free
      min: [0, 'Price cannot be negative'],
    },

    isFree: {
      type: Boolean,
      default: true,
    },

    // ---- Statistics (Denormalized for performance) ----
    enrollmentCount: {
      type: Number,
      default: 0,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalRatings: {
      type: Number,
      default: 0,
    },

    // ---- Duration ----
    // Estimated total hours (auto-calculated from lessons)
    estimatedDuration: {
      type: Number,
      default: 0, // in minutes
    },

    // ---- Prerequisites ----
    // Other courses students should complete first
    prerequisites: [
      {
        type: String,
        trim: true,
      },
    ],

    // ---- Learning Outcomes ----
    // What student will learn (for AI to explain recommendations)
    learningOutcomes: [
      {
        type: String,
        trim: true,
      },
    ],

    // ---- Topics Covered ----
    // Used by AI to match weak areas with courses
    topicsCovered: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
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
CourseSchema.index({ title: 'text', description: 'text', tags: 'text' });
CourseSchema.index({ tutor: 1 });
CourseSchema.index({ category: 1 });
CourseSchema.index({ level: 1 });
CourseSchema.index({ isPublished: 1 });

// ============================================================
// VIRTUALS
// ============================================================

// Virtual: Get modules for this course (from Module model)
CourseSchema.virtual('modules', {
  ref: 'Module',
  localField: '_id',
  foreignField: 'course',
  justOne: false,
});

// ============================================================
// INSTANCE METHODS
// ============================================================

/**
 * Calculate average rating
 */
CourseSchema.methods.calculateRating = function (newRating) {
  const totalScore = this.rating * this.totalRatings + newRating;
  this.totalRatings += 1;
  this.rating = totalScore / this.totalRatings;
  return this.rating;
};

module.exports = mongoose.model('Course', CourseSchema);
