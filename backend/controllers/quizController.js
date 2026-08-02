// controllers/quizController.js
const fs          = require('fs');
const Quiz        = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User        = require('../models/User');
const { generateQuestions }      = require('../services/aiQuizService');
const { extractTextFromPdfPath } = require('../services/pdfExtractService');
const { sendQuizResultEmail }    = require('../services/emailService');
const { generateRecommendationsForStudent } = require('./recommendationController');
const { getTopicResources } = require('../services/topicResourceService');

// NEW: forgetting curve scheduler
const { updateReviewSchedule } = require('../ai/forgettingCurve');

// ─────────────────────────────────────────────────────────────
// FIX: lesson.content is a nested object { text, videoUrl, pdfUrl... }
// not a plain string. Extract the actual text correctly.
// ─────────────────────────────────────────────────────────────
async function getLessonContent(lessonId) {
  const Lesson = require('../models/Lesson');
  const lesson = await Lesson.findById(lessonId).populate('course', '_id');
  if (!lesson) throw Object.assign(new Error('Lesson not found'), { statusCode: 404 });

  const contentObj = lesson.content || {};
  const content = (
    contentObj.text    ||
    lesson.description ||
    ''
  ).trim();

  return { lesson, content };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const normalizeAnswer = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "") // remove punctuation
    .replace(/\s+/g, " ") // normalize spacing
    .trim();

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
    } else if (q.type === 'true_false') {
      isCorrect =
        submitted?.selectedAnswer?.trim().toLowerCase() ===
        (q.correctAnswer || '').trim().toLowerCase();
    } else {
      // short_answer typo-resilient match
      isCorrect = normalizeAnswer(submitted?.selectedAnswer) === normalizeAnswer(q.correctAnswer);
    }

    const pts = isCorrect ? (q.points || 1) : 0;
    if (pts > 0) earned += pts;
    if (q.topic) (isCorrect ? strongTopics : weakTopics).add(q.topic);

    return {
      questionId:      q._id,
      questionText:    q.questionText,
      selectedOption:  submitted?.selectedOption || '',
      selectedAnswer:  submitted?.selectedAnswer || '',
      isCorrect,
      pointsEarned:    pts,
      timeTaken:       submitted?.timeTaken || 0,
      // BUGFIX: this was missing entirely, which meant the topicPerformance
      // loop in submitAttempt() below (`ans.topics?.length ? ans.topics :
      // (ans.topic ? [ans.topic] : [])`) always fell through to `[]` for
      // every single answer — topicPerformance has been an empty object
      // for every quiz result, regardless of whether questions had a topic
      // set in the DB. That silently broke the "Weak Topics" breakdown UI
      // and, as a result, the curated-resources feature that depends on it.
      topic:           q.topic || '',
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

  if (!content || content.length < 50) {
    const contentObj = lesson.content || {};
    const isVideo = !!contentObj.videoUrl;
    const isPdf   = !!contentObj.pdfUrl;

    let hint = 'Add text content to this lesson before generating questions.';
    if (isVideo) hint = 'This is a video lesson. Switch to "Upload PDF" in the Content tab/step to generate questions from a PDF instead.';
    if (isPdf)   hint = 'This is a PDF lesson. Switch to "Upload PDF" in the Content tab/step and upload the PDF file directly.';

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
    aiModel:       aiMeta.model || 'llama-3.3-70b-versatile',
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
    lesson:        lessonId     || null,
    course:        courseId     || null,
    creator:       req.user._id,
    title,
    description:   description  || '',
    questions:     questions    || [],
    timeLimit:     timeLimit    || 0,
    passingScore:  passingScore || 70,
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
// GET /api/quizzes/:id/full  (tutor/admin)
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
  res.status(200).json({
    success: true,
    message: `Quiz ${quiz.isPublished ? 'published' : 'unpublished'}`,
    data:    { isPublished: quiz.isPublished },
  });
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

  // ── Adaptive attempt limit ────────────────────────────────────────────────
  const COOLDOWN_MINUTES  = 10;
  const LOW_SCORE_CUTOFF  = 40;
  const STRUGGLE_ATTEMPTS = 3;

  const prevAttempts = await QuizAttempt.find({
    quiz: quiz._id, student: req.user._id,
  }).sort({ createdAt: -1 }).lean();

  const prevCount = prevAttempts.length;

  if (prevCount > 0) {
    const avgScore = Math.round(
      prevAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / prevCount
    );
    const lastAttempt      = prevAttempts[0];
    const minutesSinceLast = (Date.now() - new Date(lastAttempt.completedAt)) / 60000;

    if (quiz.maxAttempts > 0 && prevCount >= quiz.maxAttempts) {
      if (avgScore < LOW_SCORE_CUTOFF) {
        return res.status(403).json({
          success: false, adaptiveBlock: true, blockType: 'lesson_review',
          message: `You have attempted this quiz ${prevCount} times with an average score of ${avgScore}%. The AI recommends reviewing the lesson material first before trying again.`,
          avgScore, prevAttempts: prevCount, lessonId: quiz.lesson || null,
          weakTopics: lastAttempt.weakTopics || [],
          suggestion: 'Review the lesson, then come back to this quiz.',
        });
      }
      if (minutesSinceLast < COOLDOWN_MINUTES) {
        const waitMin = Math.ceil(COOLDOWN_MINUTES - minutesSinceLast);
        return res.status(403).json({
          success: false, adaptiveBlock: true, blockType: 'cooldown',
          message: `You have reached the attempt limit. Please wait ${waitMin} more minute${waitMin !== 1 ? 's' : ''} before trying again.`,
          waitMinutes: waitMin, avgScore, prevAttempts: prevCount,
        });
      }
    }

    if (!quiz.maxAttempts || quiz.maxAttempts === 0) {
      const recentFails = prevAttempts
        .slice(0, STRUGGLE_ATTEMPTS)
        .filter(a => (a.score || 0) < LOW_SCORE_CUTOFF);

      if (recentFails.length >= STRUGGLE_ATTEMPTS) {
        if (minutesSinceLast >= COOLDOWN_MINUTES) {
          req.softBlock = {
            avgScore, prevAttempts: prevCount,
            weakTopics: lastAttempt.weakTopics || [],
            lessonId:   quiz.lesson || null,
          };
        } else {
          const waitMin = Math.ceil(COOLDOWN_MINUTES - minutesSinceLast);
          return res.status(403).json({
            success: false, adaptiveBlock: true, blockType: 'struggle_cooldown',
            message: `You have scored below ${LOW_SCORE_CUTOFF}% on your last ${STRUGGLE_ATTEMPTS} attempts (avg: ${avgScore}%). Take a ${waitMin}-minute break and review the lesson material first.`,
            waitMinutes: waitMin, avgScore, prevAttempts: prevCount,
            lessonId: quiz.lesson || null,
            weakTopics: lastAttempt.weakTopics || [],
            suggestion: 'The AI has updated your learning path with lesson recommendations to help you improve.',
          });
        }
      }
    }
  }
  // ── End adaptive block ────────────────────────────────────────────────────

  const attemptNumber = (await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.user._id })) + 1;
  const { scoredAnswers, score, pointsEarned, totalPoints, isPassed, weakTopics, strongTopics } =
    scoreAttempt(quiz, req.body.answers || []);

  const attempt = await QuizAttempt.create({
    quiz: quiz._id, lesson: quiz.lesson, course: quiz.course, student: req.user._id,
    answers: scoredAnswers, score, pointsEarned, totalPoints, isPassed,
    timeTaken: req.body.timeTaken || 0, completedAt: new Date(),
    attemptNumber, weakTopics, strongTopics,
    isFlagged:           req.body.isFlagged           || false,
    violationCount:      req.body.violationCount      || 0,
    violations:          req.body.violations          || [],
    terminatedByProctor: req.body.terminatedByProctor || false,
  });

  await Quiz.findByIdAndUpdate(quiz._id, {
    $inc: { totalAttempts: 1 },
    $set: { averageScore: Math.round(((quiz.averageScore * quiz.totalAttempts) + score) / (quiz.totalAttempts + 1)) },
  });

  // ── Fire-and-forget quiz result email ────────────────────────────────────
  try {
    const student = await User.findById(req.user._id).select('name email');
    if (student?.email) {
      sendQuizResultEmail(
        { name: student.name, email: student.email },
        { title: quiz.title },
        { score, isPassed, pointsEarned, totalPoints, weakTopics, attemptNumber }
      );
    }
  } catch { /* non-critical */ }

  // ── Build topicPerformance for the response ───────────────────────────────
  // QuizResultPage needs per-topic correct/total/percentage to render the
  // weak/average/strong topic breakdown. scoreAttempt() already groups
  // weakTopics/strongTopics by name but not by raw correct/total counts,
  // so we recompute it here from scoredAnswers.
  const topicPerformance = {};
  for (const ans of scoredAnswers) {
    const topics = ans.topics?.length ? ans.topics : (ans.topic ? [ans.topic] : []);
    for (const t of topics) {
      if (!topicPerformance[t]) topicPerformance[t] = { correct: 0, total: 0 };
      topicPerformance[t].total += 1;
      if (ans.isCorrect) topicPerformance[t].correct += 1;
    }
  }
  for (const t of Object.keys(topicPerformance)) {
    const { correct, total } = topicPerformance[t];
    topicPerformance[t].percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  // ── Curated external resources for weak topics ───────────────────────────
  // Alongside "refer this lesson," also surface real videos/articles for any
  // topic below the quiz's passing score — e.g. "you're weak in Arrays,
  // here's a video and an article on it." Internal lesson recs stay primary
  // (they're the ones that feed progress tracking); these are supplementary.
  // getTopicResources() returns [] for topics not yet in the curated
  // library — frontend must treat that as "no resources yet," not an error.
  const passThreshold = quiz.passingScore ?? 70;
  for (const t of Object.keys(topicPerformance)) {
    if (topicPerformance[t].percentage < passThreshold) {
      topicPerformance[t].resources = getTopicResources(t, { limit: 3 });
    }
  }

  // ── Forgetting curve — fire-and-forget (fast, non-blocking) ──────────────
  setImmediate(async () => {
    try {
      if (quiz.lesson) {
        await updateReviewSchedule(
          req.user._id,   // studentId
          quiz.lesson,    // lessonId
          quiz.course,    // courseId
          null,           // moduleId — resolved automatically inside updateReviewSchedule
          score           // quiz score 0-100
        );
      }
    } catch (err) {
      console.error('[SR] forgettingCurve error (non-critical):', err.message);
    }
  });

  // ── Recommendations + SHAP — AWAITED so the response can include the ─────
  // explanation immediately. This is what QuizResultPage's ShapExplanationPanel
  // reads. Previously this ran fire-and-forget and its result was discarded,
  // so the student never saw a SHAP explanation on the result screen — they
  // only saw it later if they separately visited /recommendations.
  let shapExplanation = null;
  try {
    const recommendation = await generateRecommendationsForStudent(req.user._id);
    shapExplanation = recommendation?.analysisSummary?.shapExplanation || null;
  } catch (err) {
    // Non-critical — quiz result still returns successfully without SHAP data
    console.error('[Recommendations] generation error (non-critical):', err.message);
  }

  res.status(201).json({
    success: true,
    message: isPassed ? 'Congratulations, you passed!' : 'Quiz submitted.',
    data: {
      score,
      scorePercentage: score,   // alias — QuizResultPage reads either name
      pointsEarned, totalPoints, isPassed, attemptNumber,
      weakTopics, strongTopics, answers: scoredAnswers,
      topicPerformance,
      lessonId: quiz.lesson || null,
      courseId: quiz.course || null,
      recommendationsUpdated: true,
      analysisSummary: shapExplanation ? { shapExplanation } : null,
      softBlock: req.softBlock || null,
    },
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
  const topicFreq     = allWeakTopics.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  const topWeakTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => ({ topic, count }));
  const overallAvg    = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;

  res.status(200).json({
    success: true,
    data: {
      quizzes, totalAttempts: attempts.length, overallAverage: overallAvg,
      passRate: attempts.length ? Math.round(attempts.filter(a => a.isPassed).length / attempts.length * 100) : 0,
      topWeakTopics,
    },
  });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/course/:courseId
// ─────────────────────────────────────────────────────────────
exports.getQuizzesByCourse = async (req, res) => {
  const quizzes = await Quiz.find({
    course: req.params.courseId,
    isPublished: true,
  }).populate('lesson', 'title order module').sort({ createdAt: 1 }).lean();
  res.json({ success: true, count: quizzes.length, data: quizzes });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/analytics/course/:courseId/trend
// Returns daily average score over the last 30 days
// ─────────────────────────────────────────────────────────────
exports.getCourseScoreTrend = async (req, res) => {
  const { courseId } = req.params;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const attempts = await QuizAttempt.find({
    course: courseId,
    createdAt: { $gte: since },
  }).select('score createdAt').lean();

  // Group by day
  const byDay = {};
  for (const a of attempts) {
    const day = a.createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
    byDay[day].total += a.score;
    byDay[day].count += 1;
  }

  const trend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      avgScore: Math.round(total / count),
      attempts: count,
    }));

  res.json({ success: true, data: trend });
};

// ─────────────────────────────────────────────────────────────
// GET /api/quizzes/analytics/course/:courseId/distribution
// Returns score distribution in buckets: 0-20, 20-40, ..., 80-100
// ─────────────────────────────────────────────────────────────
exports.getCourseScoreDistribution = async (req, res) => {
  const { courseId } = req.params;
  const attempts = await QuizAttempt.find({ course: courseId }).select('score').lean();

  const buckets = [
    { label: '0-20',  min: 0,  max: 20,  count: 0 },
    { label: '21-40', min: 21, max: 40,  count: 0 },
    { label: '41-60', min: 41, max: 60,  count: 0 },
    { label: '61-80', min: 61, max: 80,  count: 0 },
    { label: '81-100',min: 81, max: 100, count: 0 },
  ];

  for (const a of attempts) {
    const bucket = buckets.find(b => a.score >= b.min && a.score <= b.max);
    if (bucket) bucket.count++;
  }

  res.json({ success: true, data: buckets });
};

// ─────────────────────────────────────────────────────────────
// POST /api/quizzes/:id/violation
// ─────────────────────────────────────────────────────────────
exports.logViolation = async (req, res) => {
  const { type, message, timestamp } = req.body;
  if (!type) return res.status(400).json({ success: false, message: 'Violation type required' });

  const attempt = await QuizAttempt.findOne({
    quiz:    req.params.id,
    student: req.user._id,
  }).sort({ createdAt: -1 });

  if (!attempt) {
    return res.status(200).json({ success: true, message: 'No attempt found, violation noted' });
  }

  attempt.violations.push({ type, message, timestamp: timestamp ? new Date(timestamp) : new Date() });
  attempt.violationCount = attempt.violations.length;
  attempt.isFlagged      = true;
  await attempt.save();

  res.status(200).json({ success: true, message: 'Violation logged', violationCount: attempt.violationCount });
};