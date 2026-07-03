// ============================================================
// controllers/moduleController.js - Module & Lesson CRUD
// ============================================================
//
// FIXES in this version:
//
//  markLessonComplete now does 3 things it was missing:
//
//  1. FORGETTING CURVE — calls updateReviewSchedule() after every lesson
//     completion so the SR scheduler knows when to resurface this lesson.
//     Previously, SR only triggered after quiz attempts (in quizController).
//     Now lesson completions also set srNextReviewAt on the Progress document,
//     which feeds getTopicsNeedingReview() → "Due for Review" recommendations.
//     Score used: 50 (neutral baseline — no quiz taken yet; SR will update
//     again with the real score once the student takes the lesson's quiz).
//
//  2. ENROLLMENT PROGRESS — updates Enrollment.completedLessons[] and
//     recalculates completionPercentage after marking a lesson complete.
//     Previously this was only done via PUT /api/enrollments/:courseId/progress
//     (a separate call LessonPage never made), so the progress bar always showed 0%.
//
//  3. Both run in a setImmediate (fire-and-forget) so the HTTP response is
//     never delayed — same pattern used in quizController.

const Module     = require('../models/Module');
const Lesson     = require('../models/Lesson');
const Course     = require('../models/Course');
const Progress   = require('../models/Progress');
const Enrollment = require('../models/Enrollment');

const { updateReviewSchedule } = require('../ai/forgettingCurve');

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
    const lessons = await Lesson.find({ module: req.params.moduleId }).sort({ order: 1 });
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

    // ── 1. Upsert core Progress record (unchanged) ──────────────────────────
    const progress = await Progress.findOneAndUpdate(
      { student: req.user._id, lesson: lesson._id },
      {
        $set: {
          isCompleted:    true,
          completedAt:    new Date(),
          lastAccessedAt: new Date(),
          module:         lesson.module,
          course:         lesson.course,
        },
        $inc: { timeSpent, visitCount: 1 },
      },
      { upsert: true, new: true }
    );

    // ── 2. Respond immediately — background work below ──────────────────────
    res.status(200).json({
      success: true,
      message: 'Lesson marked as complete',
      data:    progress,
    });

    // ── 3. Fire-and-forget: forgetting curve + enrollment progress ───────────
    // Uses setImmediate so the HTTP response above is never delayed,
    // matching the same pattern used in quizController.submitAttempt.
    setImmediate(async () => {
      try {
        // ── 3a. FORGETTING CURVE ─────────────────────────────────────────────
        // Score 50 = neutral baseline for a lesson completion with no quiz yet.
        // The SM-2 algorithm will schedule the first review for tomorrow (1 day).
        // When the student later takes the quiz, quizController will call
        // updateReviewSchedule() again with the real score, overwriting this entry
        // and adjusting the interval accordingly.
        await updateReviewSchedule(
          req.user._id,   // studentId
          lesson._id,     // lessonId
          lesson.course,  // courseId
          lesson.module,  // moduleId — already known, no extra DB lookup needed
          50              // baseline score for lesson-only completion
        );
        console.log(`[SR] Forgetting curve scheduled for lesson "${lesson.title}" — student ${req.user._id}`);

        // ── 3b. ENROLLMENT PROGRESS ──────────────────────────────────────────
        // Find the student's enrollment for this course and update
        // completedLessons[] + recalculate completionPercentage.
        // Uses the Enrollment model's built-in markLessonComplete() method
        // (defined in models/Enrollment.js) which handles deduplication and %.
        const enrollment = await Enrollment.findOne({
          student: req.user._id,
          course:  lesson.course,
        });

        if (enrollment) {
          const totalLessons = await Lesson.countDocuments({
            course:      lesson.course,
            isPublished: true,
          });
          enrollment.markLessonComplete(lesson._id, totalLessons);
          enrollment.lastAccessedAt  = new Date();
          enrollment.currentLesson   = lesson._id;
          await enrollment.save();
          console.log(
            `[Progress] Enrollment updated for student ${req.user._id} — ` +
            `${enrollment.completionPercentage}% complete`
          );
        }
      } catch (err) {
        // Non-critical: log but never crash the server
        console.error('[markLessonComplete] Background task error (non-critical):', err.message);
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getModules, createModule, updateModule, deleteModule,
  getLessons, getLesson, createLesson, updateLesson, deleteLesson,
  markLessonComplete,
};