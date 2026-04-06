// controllers/quizController.js
const fs          = require('fs');
const Quiz        = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { generateQuestions }      = require('../services/aiQuizService');
const { extractTextFromPdfPath } = require('../services/pdfExtractService');

// ─────────────────────────────────────────────────────────────
// FIX: lesson.content is a nested object { text, videoUrl, pdfUrl... }
// not a plain string. Extract the actual text correctly.
// ─────────────────────────────────────────────────────────────
async function getLessonContent(lessonId) {
  const Lesson = require('../models/Lesson');
  const lesson = await Lesson.findById(lessonId).populate('course', '_id');
  if (!lesson) throw Object.assign(new Error('Lesson not found'), { statusCode: 404 });

  // lesson.content is { text: '...', videoUrl: '...', pdfUrl: '...' }
  // Pull the text out of the nested object, then fall back to description
  const contentObj = lesson.content || {};
  const content = (
    contentObj.text          ||   // text lesson
    lesson.description       ||   // fallback field
    ''
  ).trim();

  return { lesson, content };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function scoreAttempt(quiz, answers) {
  let earned = 0;
  const total = quiz.questions.reduce((s, q) => s + (q.points || 1), 0);
  const weakTopics   = new Set();
  const strongTopics = new Set();

  const scoredAnswers = quiz.questions.map(q => {
    const submitted = answers.find(a => String(a.questionId) === String(q._id));
    let isCorrect = false;

    if (q.type === 'mcq') {
      const correct = q.options.find(o => o.isCorrect)?.text || '';
      isCorrect = submitted?.selectedOption?.trim().toLowerCase() === correct.toLowerCase();
    } else {
      isCorrect =
        submitted?.selectedAnswer?.trim().toLowerCase() ===
        (q.correctAnswer || '').trim().toLowerCase();
    }

    const pts = isCorrect ? (q.points || 1) : 0;
    if (pts > 0) earned += pts;
    if (q.topic) (isCorrect ? strongTopics : weakTopics).add(q.topic);

    return {
      questionId:     q._id,
      questionText:   q.questionText,
      selectedOption: submitted?.selectedOption || '',
      selectedAnswer: submitted?.selectedAnswer || '',
      isCorrect,
      pointsEarned:   pts,
      timeTaken:      submitted?.timeTaken || 0,
    };
  });

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  return {
    scoredAnswers,
    score,
    pointsEarned: earned,
    totalPoints:  total,
    isPassed:     score >= (quiz.passingScore || 70),
    weakTopics:   [...weakTopics],
    strongTopics: [...strongTopics],
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/quizzes/generate
// ─────────────────────────────────────────────────────────────
exports.generateQuiz = async (req, res) => {
  const {
    lessonId,
    numQuestions = 5,
    difficulty   = 'medium',
    types        = ['mcq', 'true_false'],
    focusArea    = '',
  } = req.body;

  if (!lessonId) {
    return res.status(400).json({ success: false, message: 'lessonId is required' });
  }

  const { lesson, content } = await getLessonContent(lessonId);

  // Give a helpful message depending on why content is empty
  if (!content || content.length < 50) {
    const contentObj = lesson.content || {};
    const isVideo = !!contentObj.videoUrl;
    const isPdf   = !!contentObj.pdfUrl;

    let hint = 'Add text content to this lesson before generating questions.';
    if (isVideo) hint = 'This is a video lesson. Switch to "Upload a PDF" in the AI panel to generate questions from a PDF instead.';
    if (isPdf)   hint = 'This is a PDF lesson. Switch to "Upload a PDF" in the AI panel and upload the PDF file directly.';

    return res.status(400).json({
      success: false,
      message: `Lesson text content is too short or empty. ${hint}`,
    });
  }

  const { questions, meta } = await generateQuestions({
    content, numQuestions, difficulty, types, focusArea,
  });

  res.status(200).json({
    success: true,
    message: `${questions.length} questions generated`,
    data: {
      lessonId,
      courseId:    lesson.course?._id || lesson.course,
      lessonTitle: lesson.title,
      questions,
      meta,
    },
  });
};

// ─────────────────────────────────────────────────────────────
// POST /api/quizzes/generate-from-pdf
// ─────────────────────────────────────────────────────────────
exports.generateFromPdf = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'PDF file is required' });
  }

  const {
    lessonId,
    numQuestions = 5,
    difficulty   = 'medium',
    types        = ['mcq', 'true_false'],
    focusArea    = '',
  } = req.body;

  const typesArr = typeof types === 'string' ? JSON.parse(types) : types;

  let content;
  try {
    content = await extractTextFromPdfPath(req.file.path);
  } finally {
    fs.unlink(req.file.path, () => {});
  }

  let courseId, lessonTitle;
  if (lessonId) {
    const { lesson } = await getLessonContent(lessonId);
    courseId    = lesson.course?._id || lesson.course;
    lessonTitle = lesson.title;
  }

  const { questions, meta } = await generateQuestions({
    content,
    numQuestions: Number(numQuestions),
    difficulty,
    types:        typesArr,
    focusArea,
  });

  res.status(200).json({
    success: true,
    message: `${questions.length} questions generated from PDF`,
    data: {
      lessonId:    lessonId || null,
      courseId:    courseId || null,
      lessonTitle: lessonTitle || req.file.originalname,
      questions,
      sourceType:  'pdf',
      meta,
    },
  });
};

// ─────────────────────────────────────────────────────────────
// POST /api/quizzes/save-generated
// ─────────────────────────────────────────────────────────────
exports.saveGeneratedQuiz = async (req, res) => {
  const {
    lessonId, courseId, title, questions,
    timeLimit = 0, passingScore = 70,
    shuffleQuestions = false, shuffleOptions = true,
    maxAttempts = 0, aiMeta = {},
  } = req.body;

  if (!lessonId || !courseId || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'lessonId, courseId, and at least one question are required',
    });
  }

  const quiz = await Quiz.create({
    lesson: lessonId, course: courseId, creator: req.user._id,
    title: title || 'AI-Generated Quiz', questions,
    timeLimit, passingScore, shuffleQuestions, shuffleOptions, maxAttempts,
    isAIGenerated: true,
    aiModel:       aiMeta.model || 'claude-sonnet-4-20250514',
    aiGeneratedAt: new Date(),
    aiSourceType:  aiMeta.sourceType || 'lesson_text',
    aiPromptConfig: {
      numQuestions: aiMeta.numQuestions, difficulty: aiMeta.difficulty,
      types: aiMeta.types, focusArea: aiMeta.focusArea,
    },
    isPublished: false,
  });

  res.status(201).json({ success: true, message: 'Quiz saved. Review and publish when ready.', data: quiz });
};

// ─────────────────────────────────────────────────────────────
// POST /api/quizzes  — Create manual quiz
// ─────────────────────────────────────────────────────────────
exports.createQuiz = async (req, res) => {
  const { lessonId, courseId, title, description, questions, timeLimit, passingScore } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }

  const quiz = await Quiz.create({
    lesson:       lessonId  || null,
    course:       courseId  || null,
    creator:      req.user._id,
    title,
    description:  description  || '',
    questions:    questions    || [],
    timeLimit:    timeLimit    || 0,
    passingScore: passingScore || 70,
    isAIGenerated: false,
    isPublished:   false,
  });

  res.status(201).json({ success: true, data: quiz });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/lesson/:lessonId
// ─────────────────────────────────────────────────────────────
exports.getQuizzesByLesson = async (req, res) => {
  const { lessonId } = req.params;
  // FIX: include 'tutor' as instructor-level role
  const isInstructor = ['tutor', 'instructor', 'admin'].includes(req.user?.role);

  const filter = { lesson: lessonId };
  if (!isInstructor) filter.isPublished = true;

  const quizzes = await Quiz.find(filter)
    .select(isInstructor
      ? '-questions.options.isCorrect -questions.correctAnswer'
      : '-questions.options.isCorrect -questions.correctAnswer -questions.explanation')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, count: quizzes.length, data: quizzes });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/:id  (student-safe)
// ─────────────────────────────────────────────────────────────
exports.getQuiz = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
    .select('-questions.options.isCorrect -questions.correctAnswer -questions.explanation')
    .lean();
  if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
  res.status(200).json({ success: true, data: quiz });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/:id/full  (tutor/admin — includes answers)
// ─────────────────────────────────────────────────────────────
exports.getQuizFull = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
  res.status(200).json({ success: true, data: quiz });
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/quizzes/:id/publish
// ─────────────────────────────────────────────────────────────
exports.publishQuiz = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
  if (quiz.questions.length === 0) {
    return res.status(400).json({ success: false, message: 'Cannot publish a quiz with no questions' });
  }
  quiz.isPublished = !quiz.isPublished;
  if (quiz.isPublished) quiz.publishedAt = new Date();
  await quiz.save();
  res.status(200).json({ success: true, message: `Quiz ${quiz.isPublished ? 'published' : 'unpublished'}`, data: { isPublished: quiz.isPublished } });
};

// ─────────────────────────────────────────────────────────────
// PUT /api/quizzes/:id
// ─────────────────────────────────────────────────────────────
exports.updateQuiz = async (req, res) => {
  const allowed = ['title','description','questions','timeLimit','passingScore','shuffleQuestions','shuffleOptions','maxAttempts'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  const quiz = await Quiz.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
  res.status(200).json({ success: true, data: quiz });
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/quizzes/:id
// ─────────────────────────────────────────────────────────────
exports.deleteQuiz = async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id);
  if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
  await QuizAttempt.deleteMany({ quiz: req.params.id });
  res.status(200).json({ success: true, message: 'Quiz and all attempts deleted' });
};

// ─────────────────────────────────────────────────────────────
// POST /api/quizzes/:id/attempt
// ─────────────────────────────────────────────────────────────
exports.submitAttempt = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || !quiz.isPublished) {
    return res.status(404).json({ success: false, message: 'Quiz not found or not published' });
  }
  if (quiz.maxAttempts > 0) {
    const prevCount = await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.user._id });
    if (prevCount >= quiz.maxAttempts) {
      return res.status(400).json({ success: false, message: `Max ${quiz.maxAttempts} attempts reached` });
    }
  }
  const attemptNumber = (await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.user._id })) + 1;
  const { scoredAnswers, score, pointsEarned, totalPoints, isPassed, weakTopics, strongTopics } =
    scoreAttempt(quiz, req.body.answers || []);

  const attempt = await QuizAttempt.create({
    quiz: quiz._id, lesson: quiz.lesson, course: quiz.course, student: req.user._id,
    answers: scoredAnswers, score, pointsEarned, totalPoints, isPassed,
    timeTaken: req.body.timeTaken || 0, completedAt: new Date(),
    attemptNumber, weakTopics, strongTopics,
  });

  await Quiz.findByIdAndUpdate(quiz._id, {
    $inc: { totalAttempts: 1 },
    $set: { averageScore: Math.round(((quiz.averageScore * quiz.totalAttempts) + score) / (quiz.totalAttempts + 1)) },
  });

  res.status(201).json({
    success: true,
    message: isPassed ? 'Congratulations, you passed!' : 'Quiz submitted.',
    data: { score, pointsEarned, totalPoints, isPassed, attemptNumber, weakTopics, strongTopics, answers: scoredAnswers },
  });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/:id/attempts  (tutor/admin)
// ─────────────────────────────────────────────────────────────
exports.getAttempts = async (req, res) => {
  const attempts = await QuizAttempt.find({ quiz: req.params.id })
    .populate('student', 'name email').sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, count: attempts.length, data: attempts });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/:id/my-attempts  (student)
// ─────────────────────────────────────────────────────────────
exports.getMyAttempts = async (req, res) => {
  const attempts = await QuizAttempt.find({ quiz: req.params.id, student: req.user._id })
    .sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, count: attempts.length, data: attempts });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/analytics/course/:courseId
// ─────────────────────────────────────────────────────────────
exports.getCourseAnalytics = async (req, res) => {
  const { courseId } = req.params;
  const [quizzes, attempts] = await Promise.all([
    Quiz.find({ course: courseId }).select('title totalAttempts averageScore isPublished isAIGenerated').lean(),
    QuizAttempt.find({ course: courseId }).select('score isPassed weakTopics student').lean(),
  ]);
  const allWeakTopics = attempts.flatMap(a => a.weakTopics || []);
  const topicFreq = allWeakTopics.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  const topWeakTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => ({ topic, count }));
  const overallAvg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;
  res.status(200).json({
    success: true,
    data: {
      quizzes, totalAttempts: attempts.length, overallAverage: overallAvg,
      passRate: attempts.length ? Math.round(attempts.filter(a => a.isPassed).length / attempts.length * 100) : 0,
      topWeakTopics,
    },
  });
};