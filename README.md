# 🎓 AI-Powered Personalized Learning Platform
### with Explainable Recommendations (XAI)

A full-stack EdTech platform where AI analyzes student performance and recommends personalized learning paths — with **transparent explanations** for every recommendation.

---

## 🏗️ Project Architecture

```
ai-learning-platform/
├── backend/                          # Node.js + Express API
│   ├── ai/
│   │   └── recommendationEngine.js  # 🤖 AI Engine (Rule-based + Scoring)
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js        # Register, Login, JWT
│   │   ├── courseController.js      # Course CRUD
│   │   ├── moduleController.js      # Modules + Lessons CRUD
│   │   ├── enrollmentController.js  # Enrollment + Progress
│   │   ├── quizController.js        # Quiz + Submission + Grading
│   │   ├── recommendationController.js # AI Recommendations
│   │   └── adminController.js       # Admin dashboard data
│   ├── middleware/
│   │   ├── auth.js                  # JWT protect + authorize
│   │   ├── errorHandler.js          # Global error handling
│   │   └── validate.js              # Input validation
│   ├── models/
│   │   ├── User.js                  # Users (student/tutor/admin)
│   │   ├── Course.js                # Course schema
│   │   ├── Module.js                # Course modules/sections
│   │   ├── Lesson.js                # Lessons (video/text/PDF)
│   │   ├── Quiz.js                  # Quizzes + Questions
│   │   ├── Enrollment.js            # Enrollments + Progress %
│   │   ├── Result.js                # Quiz results + topic stats
│   │   ├── Progress.js              # Per-lesson progress tracking
│   │   └── Recommendation.js        # AI recommendations + XAI data
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── moduleRoutes.js
│   │   ├── lessonRoutes.js
│   │   ├── quizRoutes.js
│   │   ├── enrollmentRoutes.js
│   │   ├── recommendationRoutes.js
│   │   └── adminRoutes.js
│   ├── utils/
│   │   └── seeder.js                # Database seed with demo data
│   ├── .env                         # Environment config
│   ├── .env.example                 # Config template
│   ├── package.json
│   └── server.js                    # 🚀 Main Express entry point
│
└── frontend/                        # React.js SPA
    └── src/
        ├── components/
        │   ├── common/
        │   │   ├── Navbar.js
        │   │   └── StatCard.js      # Reusable UI components
        │   ├── course/
        │   │   └── CourseCard.js
        │   └── recommendations/
        │       └── RecommendationCard.js  # XAI explanation card
        ├── context/
        │   └── AuthContext.js       # Global auth state (React Context)
        ├── pages/
        │   ├── HomePage.js
        │   ├── LoginPage.js
        │   ├── RegisterPage.js
        │   ├── CoursesPage.js
        │   ├── CourseDetailPage.js
        │   ├── LessonPage.js        # Lesson viewer with sidebar
        │   ├── QuizPage.js          # Timed quiz with navigation
        │   ├── QuizResultPage.js    # Results with XAI explanations
        │   ├── StudentDashboard.js
        │   ├── TutorDashboard.js
        │   ├── AdminDashboard.js
        │   ├── CreateCoursePage.js
        │   ├── ManageCoursePage.js
        │   └── RecommendationsPage.js  # 🤖 AI Learning Path page
        ├── utils/
        │   └── api.js               # Axios instance + all API calls
        ├── App.js                   # Routes + Auth guards
        └── index.css                # Design system (CSS variables)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone / Extract
```bash
cd ai-learning-platform
```

### 2. Backend Setup
```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env — set MONGO_URI (local or Atlas)

# Start server
npm run dev          # Development (nodemon)
npm start            # Production
```

### 3. Seed Demo Data
```bash
# Inside backend/
npm run seed

# Creates:
# 👤 admin@ailearn.com   / password123  (Admin)
# 👤 tutor@ailearn.com   / password123  (Tutor)
# 👤 student@ailearn.com / password123  (Student)
# Plus: 1 course, 3 modules, 6 lessons, 2 quizzes
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm start
# Opens at http://localhost:3000
```

---

## 🌐 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register user |
| POST | `/api/auth/login` | Public | Login & get JWT |
| GET | `/api/auth/me` | 🔒 Any | Get current user |
| GET | `/api/courses` | Public | List published courses |
| POST | `/api/courses` | 🔒 Tutor | Create course |
| GET | `/api/courses/:id` | Public | Get course + modules |
| POST | `/api/enrollments/:courseId` | 🔒 Student | Enroll in course |
| GET | `/api/enrollments/my` | 🔒 Student | My enrollments |
| GET | `/api/modules/:moduleId/lessons` | 🔒 Any | Get lessons |
| POST | `/api/lessons/:id/complete` | 🔒 Student | Mark lesson done |
| GET | `/api/quizzes/:id` | 🔒 Any | Get quiz (no answers) |
| POST | `/api/quizzes/:id/submit` | 🔒 Student | Submit quiz attempt |
| POST | `/api/recommendations/generate` | 🔒 Student | 🤖 Generate AI path |
| GET | `/api/recommendations/my` | 🔒 Student | Get my recommendations |
| GET | `/api/recommendations/analysis` | 🔒 Student | Performance analysis |
| GET | `/api/admin/stats` | 🔒 Admin | Platform statistics |

---

## 🤖 AI Recommendation Engine

### How It Works

```
Student completes quizzes
         ↓
Results stored with per-topic breakdown
         ↓
AI Engine called (POST /api/recommendations/generate)
         ↓
┌─────────────────────────────────────┐
│  aggregateTopicPerformance()         │
│  → Merge all quiz results            │
│  → Calculate % per topic             │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  Classify Topics                     │
│  → score < 60%  → WEAK              │
│  → score >= 80% → STRONG            │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  buildRecommendationItems()          │
│  Strategy 1: Lessons for weak topics │
│  Strategy 2: Quizzes to reinforce    │
│  Strategy 3: Advanced for strong     │
│  Strategy 4: Next lesson fallback    │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  generateLessonExplanation() — XAI  │
│  "You are struggling with Arrays     │
│   (40%). This lesson covers Arrays   │
│   and will strengthen your           │
│   understanding."                    │
└─────────────────────────────────────┘
         ↓
Saved to Recommendation collection
Served to frontend with full XAI data
```

### Explainable AI (XAI) Fields
Each recommendation includes:
- `explanation` — Human-readable "WHY" text
- `addressesTopic` — Which weak topic this addresses
- `confidence` — AI confidence score (0-100%)
- `reasonFactors` — Structured breakdown of reasoning
  - `factor` — e.g. `"low_quiz_score"`
  - `value` — e.g. `40` (40%)
  - `description` — e.g. `"Quiz score of 40% in Arrays"`

---

## 🔐 Authentication Flow

```
POST /api/auth/login
  → Validate credentials
  → Compare bcrypt password
  → Generate JWT (7 days)
  → Set HttpOnly cookie + return token

Protected Route:
  → Authorization: Bearer <token>
  → protect middleware verifies JWT
  → authorize('student') checks role
  → req.user available in controller
```

---

## 📊 Database Schema Summary

| Collection | Key Fields |
|------------|------------|
| `users` | name, email, password (hashed), role, learningLevel |
| `courses` | title, category, level, tutor, topicsCovered, isPublished |
| `modules` | title, course, order, topics |
| `lessons` | title, module, course, contentType, content, topics |
| `quizzes` | title, module, questions[{options, isCorrect, topic}] |
| `enrollments` | student, course, completionPercentage, completedLessons |
| `results` | student, quiz, scorePercentage, topicPerformance{Map} |
| `progress` | student, lesson, isCompleted, timeSpent |
| `recommendations` | student, recommendations[], analysisSummary, explanations |

---

## 🎭 Demo Accounts

After running `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| 👑 Admin | admin@ailearn.com | password123 |
| 👨‍🏫 Tutor | tutor@ailearn.com | password123 |
| 🎓 Student | student@ailearn.com | password123 |

### Demo Flow
1. Login as **Student** → take a quiz → score low on Arrays
2. Click **AI Recommendations** → click **Generate**
3. See recommendations WITH explanations like:
   > *"You are struggling with Arrays (40%). This lesson will help strengthen that topic."*
4. Login as **Tutor** → create a course → add modules + lessons
5. Login as **Admin** → see platform-wide stats

---

## 🛠️ Development Commands

```bash
# Backend
npm run dev          # nodemon hot-reload
npm run seed         # Seed demo data

# Frontend
npm start            # React dev server (port 3000)
npm run build        # Production build
```

---

## 🔮 Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Backend setup, folder structure, MongoDB |
| 2 | ✅ Done | JWT Auth (student/tutor/admin) |
| 3 | ✅ Done | Course CRUD + publish/unpublish |
| 4 | ✅ Done | Modules + Lessons (video/text/PDF) |
| 5 | ✅ Done | Enrollment + progress tracking |
| 6 | ✅ Done | Quiz creation + submission + auto-grading |
| 7 | ✅ Done | Progress tracking (% complete, time spent) |
| 8 | ✅ Done | AI recommendation engine (rule-based) |
| 9 | ✅ Done | Explainable AI with reason factors |
| 10 | ✅ Done | Student + Tutor + Admin dashboards |
| 11 | 🔜 Next | Python ML model (scikit-learn clustering) |
| 12 | 🔜 Next | File uploads (video, PDF) via Multer |
| 13 | 🔜 Next | Email notifications |
| 14 | 🔜 Next | Advanced analytics charts |

---

## 🏭 Production Checklist

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Use MongoDB Atlas for cloud database
- [ ] Set `NODE_ENV=production`
- [ ] Add HTTPS (SSL certificate)
- [ ] Configure CORS for your production domain
- [ ] Set up PM2 for process management
- [ ] Add Redis for rate limiting at scale
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Deploy backend to Railway/Render/AWS

---

*Built with ❤️ — Node.js + Express + MongoDB + React + Rule-based AI*
