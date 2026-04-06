// ============================================================
// controllers/courseController.js - Course CRUD Controller
// ============================================================

const Course = require('../models/Course');
const Module = require('../models/Module');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

// ============================================================
// @desc    Get all published courses (with filters)
// @route   GET /api/courses
// @access  Public
// ============================================================
const getCourses = async (req, res, next) => {
  try {
    const { category, level, search, page = 1, limit = 12 } = req.query;

    const query = { isPublished: true };

    if (category) query.category = category;
    if (level) query.level = level;
    if (search) query.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [courses, total] = await Promise.all([
      Course.find(query)
        .populate('tutor', 'name avatar bio')
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Course.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: courses.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// @desc    Get single course (with modules and lessons)
// @route   GET /api/courses/:id
// @access  Public
// ============================================================
const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('tutor', 'name avatar bio expertise')
      .populate({
        path: 'modules',
        options: { sort: { order: 1 } },
        populate: {
          path: 'lessons',
          options: { sort: { order: 1 } },
          select: 'title contentType estimatedDuration isFree order isPublished',
        },
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// @desc    Create a new course (Tutor only)
// @route   POST /api/courses
// @access  Private (Tutor, Admin)
// ============================================================
const createCourse = async (req, res, next) => {
  try {
    // Attach tutor from logged-in user
    req.body.tutor = req.user._id;

    const course = await Course.create(req.body);

    // Add to tutor's created courses
    await User.findByIdAndUpdate(req.user._id, {
      $push: { createdCourses: course._id },
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Tutor who owns it, Admin)
// ============================================================
const updateCourse = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Only tutor who created OR admin can update
    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this course',
      });
    }

    // Don't allow changing the tutor
    delete req.body.tutor;

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Tutor who owns it, Admin)
// ============================================================
const deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course',
      });
    }

    await course.deleteOne();

    // Remove from tutor's list
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { createdCourses: course._id },
    });

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// @desc    Publish/Unpublish course
// @route   PUT /api/courses/:id/publish
// @access  Private (Tutor, Admin)
// ============================================================
const togglePublish = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    course.isPublished = !course.isPublished;
    await course.save();

    res.status(200).json({
      success: true,
      message: `Course ${course.isPublished ? 'published' : 'unpublished'} successfully`,
      data: { isPublished: course.isPublished },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// @desc    Get tutor's own courses
// @route   GET /api/courses/my-courses
// @access  Private (Tutor)
// ============================================================
const getMyCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ tutor: req.user._id })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCourses, getCourse, createCourse, updateCourse, deleteCourse, togglePublish, getMyCourses };
