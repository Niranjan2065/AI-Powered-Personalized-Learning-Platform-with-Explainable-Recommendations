// ============================================================
// controllers/enrollmentController.js - Enrollment Controller
// ============================================================

const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const User = require('../models/User');
const Lesson = require('../models/Lesson');

// @desc  Enroll student in a course
// @route POST /api/enrollments/:courseId
// @access Private (Student)
const enrollCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!course.isPublished) return res.status(400).json({ success: false, message: 'Course is not published yet' });

    // Check already enrolled
    const existing = await Enrollment.findOne({ student: req.user._id, course: course._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You are already enrolled in this course' });
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: req.user._id,
      course: course._id,
      paymentStatus: course.isFree ? 'free' : 'paid',
      amountPaid: course.isFree ? 0 : course.price,
    });

    // Update denormalized counts
    await Promise.all([
      Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } }),
      User.findByIdAndUpdate(req.user._id, { $addToSet: { enrolledCourses: course._id } }),
    ]);

    res.status(201).json({
      success: true,
      message: `Successfully enrolled in "${course.title}"`,
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get student's enrolled courses
// @route GET /api/enrollments/my
// @access Private (Student)
const getMyEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate('course', 'title thumbnail category level tutor estimatedDuration')
      .populate({ path: 'course', populate: { path: 'tutor', select: 'name avatar' } })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: enrollments.length, data: enrollments });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single enrollment details
// @route GET /api/enrollments/:courseId
// @access Private (Student)
const getEnrollment = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: req.params.courseId,
    }).populate('course').populate('completedLessons', 'title order');

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    res.status(200).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

// @desc  Unenroll from a course
// @route DELETE /api/enrollments/:courseId
// @access Private (Student)
const unenrollCourse = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOneAndDelete({
      student: req.user._id,
      course: req.params.courseId,
    });

    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });

    await Promise.all([
      Course.findByIdAndUpdate(req.params.courseId, { $inc: { enrollmentCount: -1 } }),
      User.findByIdAndUpdate(req.user._id, { $pull: { enrolledCourses: req.params.courseId } }),
    ]);

    res.status(200).json({ success: true, message: 'Unenrolled successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all enrollments for a course (Tutor/Admin)
// @route GET /api/enrollments/course/:courseId
// @access Private (Tutor, Admin)
const getCourseEnrollments = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    if (course.tutor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const enrollments = await Enrollment.find({ course: req.params.courseId })
      .populate('student', 'name email avatar learningLevel')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: enrollments.length, data: enrollments });
  } catch (error) {
    next(error);
  }
};

// @desc  Update progress (mark lesson complete, update time)
// @route PUT /api/enrollments/:courseId/progress
// @access Private (Student)
const updateProgress = async (req, res, next) => {
  try {
    const { lessonId, timeSpent = 0 } = req.body;

    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: req.params.courseId,
    });

    if (!enrollment) return res.status(404).json({ success: false, message: 'Not enrolled in this course' });

    // Count total lessons in course
    const Lesson = require('../models/Lesson');
    const totalLessons = await Lesson.countDocuments({ course: req.params.courseId, isPublished: true });

    // Mark lesson complete
    if (lessonId) {
      enrollment.markLessonComplete(lessonId, totalLessons);
      enrollment.currentLesson = lessonId;
    }

    enrollment.totalTimeSpent += timeSpent;
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated',
      data: {
        completionPercentage: enrollment.completionPercentage,
        totalTimeSpent: enrollment.totalTimeSpent,
        status: enrollment.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { enrollCourse, getMyEnrollments, getEnrollment, unenrollCourse, getCourseEnrollments, updateProgress };
