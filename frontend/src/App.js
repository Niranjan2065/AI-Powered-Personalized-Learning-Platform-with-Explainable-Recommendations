// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

import { AuthProvider, useAuth } from './context/AuthContext';

import HomePage           from './pages/HomePage';
import LoginPage          from './pages/LoginPage';
import RegisterPage       from './pages/RegisterPage';
import CoursesPage        from './pages/CoursesPage';
import CourseDetailPage   from './pages/CourseDetailPage';
import LessonPage         from './pages/LessonPage';
import QuizPage           from './pages/QuizPage';
import QuizResultPage     from './pages/QuizResultPage';
import QuizListPage       from './pages/QuizListPage';       // ← NEW
import StudentDashboard   from './pages/StudentDashboard';
import TutorDashboard     from './pages/TutorDashboard';
import AdminDashboard     from './pages/AdminDashboard';
import CreateCoursePage   from './pages/CreateCoursePage';
import ManageCoursePage   from './pages/ManageCoursePage';
import RecommendationsPage from './pages/RecommendationsPage';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) {
    const dest = user.role === 'admin' ? '/admin' : user.role === 'tutor' ? '/tutor' : '/student';
    return <Navigate to={dest} replace />;
  }
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"            element={<HomePage />} />
      <Route path="/courses"     element={<CoursesPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
      <Route path="/login"       element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"    element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Student */}
      <Route path="/student" element={<PrivateRoute roles={['student']}><StudentDashboard /></PrivateRoute>} />
      <Route path="/learn/:courseId/lesson/:lessonId" element={<PrivateRoute roles={['student']}><LessonPage /></PrivateRoute>} />
      <Route path="/courses/:courseId/quizzes"        element={<PrivateRoute roles={['student']}><QuizListPage /></PrivateRoute>} />
      <Route path="/quiz/:quizId"                     element={<PrivateRoute roles={['student']}><QuizPage /></PrivateRoute>} />
      <Route path="/quiz/:quizId/result"              element={<PrivateRoute roles={['student']}><QuizResultPage /></PrivateRoute>} />
      <Route path="/recommendations"                  element={<PrivateRoute roles={['student']}><RecommendationsPage /></PrivateRoute>} />

      {/* Tutor */}
      <Route path="/tutor"                          element={<PrivateRoute roles={['tutor']}><TutorDashboard /></PrivateRoute>} />
      <Route path="/tutor/courses/create"           element={<PrivateRoute roles={['tutor']}><CreateCoursePage /></PrivateRoute>} />
      <Route path="/tutor/courses/:id/manage"       element={<PrivateRoute roles={['tutor', 'admin']}><ManageCoursePage /></PrivateRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop theme="light" />
      </AuthProvider>
    </BrowserRouter>
  );
}