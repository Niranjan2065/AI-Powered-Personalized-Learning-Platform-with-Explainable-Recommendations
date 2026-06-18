// ============================================================
// server.js - Main Express Application Entry Point
// ============================================================
require('dotenv').config();
require('express-async-errors');

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path         = require('path');

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes           = require('./routes/authRoutes');
const courseRoutes         = require('./routes/courseRoutes');
const moduleRoutes         = require('./routes/moduleRoutes');
const lessonRoutes         = require('./routes/lessonRoutes');
const quizRoutes           = require('./routes/quizRoutes');
const enrollmentRoutes     = require('./routes/enrollmentRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminRoutes          = require('./routes/adminRoutes');
const tutorChatRoutes      = require('./routes/tutorChatRoutes');
const devRoutes            = require('./routes/devRoutes');
// ── Phase 4: Tutor application review ────────────────────────
const { router: applicationRoutes } = require('./routes/applicationRoutes');

// Connect to MongoDB
connectDB();

const app = express();

app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:         process.env.CLIENT_URL || 'http://localhost:3000',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const limiter = rateLimit({
  windowMs:       parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:            parseInt(process.env.RATE_LIMIT_MAX) || 200,
  message:        { success: false, message: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:  false,
  validate:       { xForwardedForHeader: false },
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      50,
  message:  { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
  validate: { xForwardedForHeader: false },
});

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Static files ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Misc ──────────────────────────────────────────────────────
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/health', (req, res) => res.status(200).json({
  success: true, message: '🚀 AI Learning Platform API is running',
  environment: process.env.NODE_ENV, timestamp: new Date().toISOString(), version: '1.0.0',
}));
app.get('/api', (req, res) => res.status(200).json({
  success: true,
  message: 'AI-Powered Personalized Learning Platform API v1.0.0',
  endpoints: {
    auth: '/api/auth', courses: '/api/courses', modules: '/api/modules',
    lessons: '/api/lessons', quizzes: '/api/quizzes', enrollments: '/api/enrollments',
    recommendations: '/api/recommendations', admin: '/api/admin',
    applications: '/api/applications',
  },
}));
app.get('/', (req, res) => res.send('Backend is running 🚀'));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',            authLimiter, authRoutes);
app.use('/api/courses',         courseRoutes);
app.use('/api/modules',         moduleRoutes);
app.use('/api/lessons',         lessonRoutes);
app.use('/api/quizzes',         quizRoutes);
app.use('/api/enrollments',     enrollmentRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin',           adminRoutes);
app.use('/api/tutor-chat',      tutorChatRoutes);
app.use('/api/applications',    applicationRoutes);   // ← Phase 4 addition
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', devRoutes);
}

// ── Error handling (must be last) ─────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🎓 AI Learning Platform Backend            ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   🚀 Mode: ${process.env.NODE_ENV}                        ║`);
  console.log(`║   📡 Port: ${PORT}  →  http://localhost:${PORT}      ║`);
  console.log('╚══════════════════════════════════════════════╝\n');
});

process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
process.on('uncaughtException', (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = app;