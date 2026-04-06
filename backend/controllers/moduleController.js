// ============================================================
// controllers/moduleController.js - Module & Lesson CRUD
// ============================================================

const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const Progress = require('../models/Progress');

// ===================== MODULE CONTROLLERS =====================

// @desc  Get all modules for a course
// @route GET /api/courses/:courseId/modules
// @access Public
const getModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ course: req.params.courseId })
      .sort({ order: 1 })
      .populate({
        path: 'lessons',
        options: { sort: { order: 1 } },
        select: 'title contentType estimatedDuration isFree order isPublished topics',
      });

    res.status(200).json({ success: true, count: modules.length, data: modules });
  } catch (error) {
    next(error);
  }
};

// @desc  Create module in a course
// @route POST /api/courses/:courseId/modules
// @access Private (Tutor, Admin)
const createModule = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Auto-assign order (append at end)
    const lastModule = await Module.findOne({ course: req.params.courseId }).sort({ order: -1 });
    const order = lastModule ? lastModule.order + 1 : 1;

    const module = await Module.create({
      ...req.body,
      course: req.params.courseId,
      order,
    });

    res.status(201).json({ success: true, message: 'Module created', data: module });
  } catch (error) {
    next(error);
  }
};

// @desc  Update module
// @route PUT /api/modules/:id
// @access Private (Tutor, Admin)
const updateModule = async (req, res, next) => {
  try {
    let module = await Module.findById(req.params.id);
    if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

    const course = await Course.findById(module.course);
    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    module = await Module.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: module });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete module (also deletes its lessons)
// @route DELETE /api/modules/:id
// @access Private (Tutor, Admin)
const deleteModule = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id);
    if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

    const course = await Course.findById(module.course);
    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete all lessons in this module
    await Lesson.deleteMany({ module: module._id });
    await module.deleteOne();

    res.status(200).json({ success: true, message: 'Module and its lessons deleted' });
  } catch (error) {
    next(error);
  }
};

// ===================== LESSON CONTROLLERS =====================

// @desc  Get all lessons in a module
// @route GET /api/modules/:moduleId/lessons
// @access Private (Enrolled student, Tutor, Admin)
const getLessons = async (req, res, next) => {
  try {
    const lessons = await Lesson.find({ module: req.params.moduleId })
      .sort({ order: 1 });
    res.status(200).json({ success: true, count: lessons.length, data: lessons });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single lesson
// @route GET /api/lessons/:id
// @access Private (Enrolled student, Tutor, Admin)
const getLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id)
      .populate('module', 'title order')
      .populate('course', 'title');

    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

    res.status(200).json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
};

// @desc  Create lesson in a module
// @route POST /api/modules/:moduleId/lessons
// @access Private (Tutor, Admin)
const createLesson = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.moduleId);
    if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

    const course = await Course.findById(module.course);
    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const lastLesson = await Lesson.findOne({ module: req.params.moduleId }).sort({ order: -1 });
    const order = lastLesson ? lastLesson.order + 1 : 1;

    const lesson = await Lesson.create({
      ...req.body,
      module: req.params.moduleId,
      course: module.course,
      order,
    });

    res.status(201).json({ success: true, message: 'Lesson created', data: lesson });
  } catch (error) {
    next(error);
  }
};

// @desc  Update lesson
// @route PUT /api/lessons/:id
// @access Private (Tutor, Admin)
const updateLesson = async (req, res, next) => {
  try {
    let lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

    const course = await Course.findById(lesson.course);
    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete lesson
// @route DELETE /api/lessons/:id
// @access Private (Tutor, Admin)
const deleteLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

    const course = await Course.findById(lesson.course);
    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await lesson.deleteOne();
    res.status(200).json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc  Mark lesson as complete (Student)
// @route POST /api/lessons/:id/complete
// @access Private (Student)
const markLessonComplete = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

    const { timeSpent = 0 } = req.body;

    // Upsert progress record
    const progress = await Progress.findOneAndUpdate(
      { student: req.user._id, lesson: lesson._id },
      {
        $set: {
          isCompleted: true,
          completedAt: new Date(),
          lastAccessedAt: new Date(),
          module: lesson.module,
          course: lesson.course,
        },
        $inc: { timeSpent, visitCount: 1 },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Lesson marked as complete',
      data: progress,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getModules, createModule, updateModule, deleteModule,
  getLessons, getLesson, createLesson, updateLesson, deleteLesson, markLessonComplete,
};
