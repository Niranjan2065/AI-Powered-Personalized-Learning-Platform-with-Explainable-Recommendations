/**
 * App.jsx — FIXED
 *
 * BUGS FIXED:
 * 1. Only 5 routes were registered — now 18 routes cover all pages
 * 2. RoleRedirect was broken (tutor role wasn't handled)
 * 3. Missing: /register, /courses, /courses/:id, /tutor, /admin,
 *    /recommendations, /student, /learn/:cid/lesson/:lid,
 *    /quiz/:id, /quiz/:id/result, /tutor/courses/create,
 *    /tutor/courses/:id, /courses/:id/quizzes
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider, useAuth } from "./context/AuthContext";

// Pages
import HomePage           from "./pages/HomePage";
import LoginPage          from "./pages/LoginPage";
import RegisterPage       from "./pages/RegisterPage";
import StudentDashboard   from "./pages/StudentDashboard";
import TutorDashboard     from "./pages/TutorDashboard";
import AdminDashboard     from "./pages/AdminDashboard";
import CoursesPage        from "./pages/CoursesPage";
import CourseDetailPage   from "./pages/CourseDetailPage";
import LessonPage         from "./pages/LessonPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import QuizPage           from "./pages/QuizPage";
import QuizResultPage     from "./pages/QuizResultPage";
import QuizListPage       from "./pages/QuizListPage";
import ManageCoursePage   from "./pages/ManageCoursePage";
import CreateCoursePage   from "./pages/CreateCoursePage";
import ManageQuizPage     from "./pages/ManageQuizPage";
import StudentDetailPage  from "./pages/StudentDetailPage";

/** Redirect unauthenticated users to /login */
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Restrict to specific role(s) */
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    // redirect to their correct dashboard
    const dest = user.role === "admin" ? "/admin"
               : user.role === "tutor" || user.role === "teacher" ? "/tutor"
               : "/student";
    return <Navigate to={dest} replace />;
  }
  return children;
}

/** Smart redirect based on role */
function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin")  return <Navigate to="/admin"   replace />;
  if (user.role === "tutor" || user.role === "teacher")
    return <Navigate to="/tutor" replace />;
  return <Navigate to="/student" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"          element={<HomePage />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/courses"   element={<CoursesPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
      <Route path="/dashboard" element={<RoleRedirect />} />

      {/* Student */}
      <Route path="/student" element={
        <RequireRole roles={["student"]}><StudentDashboard /></RequireRole>
      } />
      <Route path="/recommendations" element={
        <RequireRole roles={["student"]}><RecommendationsPage /></RequireRole>
      } />
      <Route path="/learn/:courseId/lesson/:lessonId" element={
        <RequireAuth><LessonPage /></RequireAuth>
      } />
      <Route path="/quiz/:quizId" element={
        <RequireAuth><QuizPage /></RequireAuth>
      } />
      <Route path="/quiz/:quizId/result" element={
        <RequireAuth><QuizResultPage /></RequireAuth>
      } />
      <Route path="/courses/:id/quizzes" element={
        <RequireAuth><QuizListPage /></RequireAuth>
      } />

      {/* Tutor */}
      <Route path="/tutor" element={
        <RequireRole roles={["tutor","teacher"]}><TutorDashboard /></RequireRole>
      } />
      <Route path="/tutor/courses/create" element={
        <RequireRole roles={["tutor","teacher"]}><CreateCoursePage /></RequireRole>
      } />
      <Route path="/tutor/courses/:id" element={
        <RequireRole roles={["tutor","teacher"]}><ManageCoursePage /></RequireRole>
      } />
      <Route path="/tutor/courses/:courseId/quizzes/:quizId" element={
        <RequireRole roles={["tutor","teacher"]}><ManageQuizPage /></RequireRole>
      } />

      {/* Teacher (legacy Flask demo route — now served by tutor dashboard) */}
      <Route path="/teacher" element={
        <RequireRole roles={["tutor","teacher","admin"]}><TutorDashboard /></RequireRole>
      } />
      <Route path="/students/:studentId" element={
        <RequireRole roles={["tutor","teacher","admin"]}><StudentDetailPage /></RequireRole>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer
          position="bottom-right"
          autoClose={3500}
          hideProgressBar={false}
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
